import { TextractClient, AnalyzeExpenseCommand, AnalyzeExpenseCommandOutput, DetectDocumentTextCommand, DetectDocumentTextCommandOutput, Block } from "@aws-sdk/client-textract";
import { v4 as uuidv4 } from 'uuid';
import { promises as fsp } from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

const REGION = process.env.AWS_REGION || "us-east-1";

// Create Textract Client
export const textractClient = new TextractClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

/**
 * Run a command and return a promise
 */
async function run(cmd: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let stderr = "";
    p.stderr.on("data", d => (stderr += d.toString()));
    p.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed (code ${code}): ${stderr}`));
    });
  });
}

/**
 * Convert PDF to PNG images using pdftocairo directly (requires Poppler)
 */
async function pdfToPngBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const id = uuidv4();
  const dir = path.join(os.tmpdir(), `receipt_${id}`);
  await fsp.mkdir(dir, { recursive: true });

  const pdfPath = path.join(dir, "input.pdf");
  console.log(`[PDF] Writing PDF to temp: ${pdfPath}`);
  await fsp.writeFile(pdfPath, pdfBuffer);

  const outPrefix = path.join(dir, "page"); // creates page-1.png, page-2.png...
  console.log(`[PDF] Running pdftocairo...`);
  await run("pdftocairo", ["-png", "-r", "250", pdfPath, outPrefix]);

  const files = (await fsp.readdir(dir))
    .filter(f => /^page-\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] || 0);
      const nb = Number(b.match(/\d+/)?.[0] || 0);
      return na - nb;
    });

  console.log(`[PDF] Converted ${files.length} page(s)`);

  const bufs = await Promise.all(files.map(f => fsp.readFile(path.join(dir, f))));

  await fsp.rm(dir, { recursive: true, force: true });
  return bufs;
}

/**
 * Analyze a single image with Textract using direct byte upload
 */
async function analyzeImageWithTextract(imageBuffer: Buffer, pageLabel: string): Promise<AnalyzeExpenseCommandOutput & { Blocks?: Block[] }> {
  console.log(`[Textract] ${pageLabel}: Sending ${imageBuffer.length} bytes directly to Textract...`);

  // Run AnalyzeExpense and DetectDocumentText in parallel
  const expensePromise = textractClient.send(new AnalyzeExpenseCommand({
    Document: { Bytes: imageBuffer },
  }));

  const textPromise = textractClient.send(new DetectDocumentTextCommand({
    Document: { Bytes: imageBuffer },
  }));

  try {
    const [expenseResponse, textResponse] = await Promise.all([expensePromise, textPromise]);
    
    console.log(`[Textract] ${pageLabel}: Analysis complete. ExpenseDocuments: ${expenseResponse.ExpenseDocuments?.length || 0}, Blocks: ${textResponse.Blocks?.length || 0}`);
    
    // Merge Blocks into the expense response object
    return {
      ...expenseResponse,
      Blocks: textResponse.Blocks,
    };
  } catch (err) {
    console.warn(`[Textract] ${pageLabel}: Error running parallel extraction, falling back to just Expense:`, err);
    // Fallback: if one fails (e.g. DetectText), try just expense? 
    // Usually if one fails, likely auth/quota issue for both.
    throw err;
  }
}

/**
 * Combine multiple Textract responses into one
 */
function combineTextractResponses(responses: AnalyzeExpenseCommandOutput[]): AnalyzeExpenseCommandOutput {
  if (responses.length === 0) {
    return { ExpenseDocuments: [], $metadata: {} };
  }
  if (responses.length === 1) {
    return responses[0];
  }

  console.log(`[Textract] Combining ${responses.length} page responses...`);

  const combinedExpenseDocuments: any[] = [];
  let combinedBlocks: Block[] = [];
  let totalPages = 0;

  for (const response of responses as any[]) {
    if (response.ExpenseDocuments) {
      combinedExpenseDocuments.push(...response.ExpenseDocuments);
    }
    if (response.Blocks) {
      combinedBlocks.push(...response.Blocks);
    }
    totalPages += response.DocumentMetadata?.Pages || 0;
  }

  console.log(`[Textract] Combined: ${combinedExpenseDocuments.length} expense docs, ${combinedBlocks.length} blocks, ${totalPages} pages`);

  return {
    DocumentMetadata: { Pages: totalPages },
    ExpenseDocuments: combinedExpenseDocuments,
    $metadata: responses[0].$metadata,
    Blocks: combinedBlocks, // Attach raw blocks
  } as any;
}

/**
 * Main entry point: Analyze a receipt (handles both images and PDFs)
 */
export async function analyzeReceipt(inputBuffer: Buffer, mimeType: string = 'application/octet-stream'): Promise<AnalyzeExpenseCommandOutput> {
  console.log(`[Textract] Starting analysis. MimeType: ${mimeType}, Buffer size: ${inputBuffer.length} bytes`);

  // Check if it's a PDF
  const isPdf = mimeType === 'application/pdf' || inputBuffer.subarray(0, 4).toString() === '%PDF';

  if (isPdf) {
    console.log(`[Textract] PDF detected. Converting pages to images using pdftocairo...`);
    
    try {
      const images = await pdfToPngBuffers(inputBuffer);

      console.log(`[Textract] PDF converted: ${images.length} page(s)`);

      if (images.length === 0) {
        throw new Error("PDF conversion returned no images");
      }

      // Process each page through Textract
      const responses: AnalyzeExpenseCommandOutput[] = [];
      
      for (let i = 0; i < images.length; i++) {
        console.log(`[Textract] Processing page ${i + 1}/${images.length}...`);
        
        try {
          const response = await analyzeImageWithTextract(images[i], `Page ${i + 1}`);
          responses.push(response);
        } catch (pageError) {
          console.error(`[Textract] Error processing page ${i + 1}:`, pageError);
        }
      }

      if (responses.length === 0) {
        throw new Error("No pages were successfully processed");
      }

      return combineTextractResponses(responses);

    } catch (pdfError) {
      console.error(`[Textract] PDF conversion/processing failed:`, pdfError);
      throw pdfError;
    }

  } else {
    // It's an image - process directly
    console.log(`[Textract] Image detected. Processing directly...`);
    return await analyzeImageWithTextract(inputBuffer, "Image");
  }
}
