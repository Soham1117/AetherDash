import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { analyzeReceipt } from '@/lib/textract';
import { categorizeReceiptItems, ReceiptItem } from '@/lib/openai';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id);

    // Get receipt from database
    const receipt = db.prepare(`
      SELECT id, image_path, is_processed, processing_status
      FROM receipts
      WHERE id = @id
    `).get({ id: receiptId }) as {
      id: number;
      image_path: string;
      is_processed: number;
      processing_status: number;
    } | undefined;

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    if (receipt.is_processed === 1 || receipt.processing_status === 2) {
      return NextResponse.json(
        { error: 'Receipt already processed' },
        { status: 400 }
      );
    }

    // Mark as processing
    db.prepare(`
      UPDATE receipts
      SET processing_status = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id: receiptId });

    // Start background processing
    processReceiptInBackground(receiptId, receipt.image_path).catch((error) => {
      console.error('Background Textract processing failed:', error);
      db.prepare(`
        UPDATE receipts
        SET processing_status = 3, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id: receiptId });
    });

    return NextResponse.json({
      id: receiptId,
      message: 'Processing started',
      processing_status: 'processing',
    });
  } catch (error) {
    console.error('Error starting processing:', error);
    return NextResponse.json(
      { error: 'Failed to start processing' },
      { status: 500 }
    );
  }
}

async function processReceiptInBackground(receiptId: number, imagePath: string) {
  try {
    const fullImagePath = path.join(process.cwd(), imagePath);
    const buffer = fs.readFileSync(fullImagePath);

    // Determine mime type
    const ext = path.extname(fullImagePath).toLowerCase();
    
    // Check for unsupported WebP
    if (ext === '.webp') {
        throw new Error("WebP format is not supported by Textract. Please upload PNG, JPG, or PDF.");
    }

    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    
    console.log(`[Route] Processing ${fullImagePath} (Ext: ${ext}) -> Mime: ${mimeType}`);

    // Call AWS Textract (via S3)
    const result = await analyzeReceipt(buffer, mimeType);
    
    // DEBUG: Write raw Textract response to file
    const debugPath = path.join(process.cwd(), 'data', `textract_debug_${receiptId}.json`);
    fs.writeFileSync(debugPath, JSON.stringify(result, null, 2));
    console.log(`[Route] Raw Textract response saved to: ${debugPath}`);
    
    // Parse simplified fields from Textract Expense response
    let merchantName = null;
    let totalAmount = null;
    let receiptDate = null;
    let confidenceScore = 0;
    const lineItems: ReceiptItem[] = [];
    
    // Additional fields from Textract
    let subtotal: number | null = null;
    let tax: number | null = null;
    let discount: number | null = null;
    let tip: number | null = null;
    let fees: number | null = null;
    let paymentMethod: string | null = null;
    
    console.log(`[Route] Textract returned ${result.ExpenseDocuments?.length || 0} expense documents`);
    
    // Parse ALL Expense documents (for multi-page PDFs)
    if (result.ExpenseDocuments && result.ExpenseDocuments.length > 0) {
        for (let docIndex = 0; docIndex < result.ExpenseDocuments.length; docIndex++) {
            const doc = result.ExpenseDocuments[docIndex];
            console.log(`[Route] Processing ExpenseDocument ${docIndex + 1}/${result.ExpenseDocuments.length}`);
            console.log(`[Route]   SummaryFields: ${doc.SummaryFields?.length || 0}, LineItemGroups: ${doc.LineItemGroups?.length || 0}`);
            
            // Log all summary fields for debugging
            if (doc.SummaryFields) {
                console.log(`[Route] ===== RAW TEXTRACT SUMMARY FIELDS =====`);
                for (const field of doc.SummaryFields) {
                    const type = field.Type?.Text || 'UNKNOWN';
                    const value = field.ValueDetection?.Text || '(empty)';
                    const confidence = field.ValueDetection?.Confidence?.toFixed(1) || '0';
                    console.log(`[Route]   ${type}: "${value}" (${confidence}%)`);
                }
                console.log(`[Route] ========================================`);
            }
            
            // Merchant (take from first document that has it)
            if (!merchantName) {
                const merchantField = doc.SummaryFields?.find((f: any) => f.Type?.Text === 'VENDOR_NAME');
                if (merchantField) {
                    merchantName = merchantField.ValueDetection?.Text;
                    confidenceScore = (merchantField.ValueDetection?.Confidence || 0) / 100;
                    console.log(`[Route]   Found merchant: ${merchantName}`);
                }
            }

            // Total
            if (!totalAmount) {
                const totalField = doc.SummaryFields?.find((f: any) => f.Type?.Text === 'TOTAL');
                if (totalField) {
                    const amountStr = totalField.ValueDetection?.Text?.replace(/[^0-9.]/g, '');
                    if (amountStr) {
                        totalAmount = Math.round(parseFloat(amountStr) * 100);
                        console.log(`[Route]   Found total: $${(totalAmount / 100).toFixed(2)}`);
                    }
                }
            }

            // Subtotal
            if (!subtotal) {
                const subtotalField = doc.SummaryFields?.find((f: any) => f.Type?.Text === 'SUBTOTAL');
                if (subtotalField) {
                    const amountStr = subtotalField.ValueDetection?.Text?.replace(/[^0-9.]/g, '');
                    if (amountStr) {
                        subtotal = Math.round(parseFloat(amountStr) * 100);
                        console.log(`[Route]   Found subtotal: $${(subtotal / 100).toFixed(2)}`);
                    }
                }
            }

            // Tax
            if (!tax) {
                const taxField = doc.SummaryFields?.find((f: any) => f.Type?.Text === 'TAX');
                if (taxField) {
                    const amountStr = taxField.ValueDetection?.Text?.replace(/[^0-9.]/g, '');
                    if (amountStr) {
                        tax = Math.round(parseFloat(amountStr) * 100);
                        console.log(`[Route]   Found tax: $${(tax / 100).toFixed(2)}`);
                    }
                }
            }

            // Discount - look for delivery/scheduled discounts, not loyalty (already in product price)
            if (!discount) {
                // First try to find a discount that mentions "delivery" or "scheduled" in the label
                const discountFields = doc.SummaryFields?.filter((f: any) => f.Type?.Text === 'DISCOUNT') || [];
                
                for (const discountField of discountFields) {
                    const label = discountField.LabelDetection?.Text?.toLowerCase() || '';
                    const rawValue = discountField.ValueDetection?.Text;
                    console.log(`[Route]   Discount found: label="${discountField.LabelDetection?.Text}", value="${rawValue}"`);
                    
                    // Only take delivery/scheduled discounts
                    if (label.includes('delivery') || label.includes('scheduled')) {
                        const amountStr = rawValue?.replace(/[^0-9.]/g, '');
                        if (amountStr) {
                            discount = Math.round(parseFloat(amountStr) * 100);
                            console.log(`[Route]   Using delivery discount: $${(discount / 100).toFixed(2)}`);
                            break;
                        }
                    }
                }
            }

            // Tip/Gratuity
            if (!tip) {
                const tipField = doc.SummaryFields?.find((f: any) => 
                    f.Type?.Text === 'GRATUITY' || f.Type?.Text === 'TIP'
                );
                if (tipField) {
                    const amountStr = tipField.ValueDetection?.Text?.replace(/[^0-9.]/g, '');
                    if (amountStr) {
                        tip = Math.round(parseFloat(amountStr) * 100);
                        console.log(`[Route]   Found tip: $${(tip / 100).toFixed(2)}`);
                    }
                }
            }

            // Fees (service charge, delivery fee, etc.) - DO NOT use OTHER, it's too generic
            if (!fees) {
                const feeField = doc.SummaryFields?.find((f: any) => 
                    f.Type?.Text === 'SERVICE_CHARGE' || 
                    f.Type?.Text === 'DELIVERY_FEE'
                );
                if (feeField) {
                    const rawValue = feeField.ValueDetection?.Text;
                    const fieldType = feeField.Type?.Text;
                    console.log(`[Route]   Fee field found: type="${fieldType}", raw="${rawValue}"`);
                    const amountStr = rawValue?.replace(/[^0-9.]/g, '');
                    if (amountStr) {
                        fees = Math.round(parseFloat(amountStr) * 100);
                        console.log(`[Route]   Found fees (${fieldType}): $${(fees / 100).toFixed(2)}`);
                    }
                }
            }

            // Payment Method
            if (!paymentMethod) {
                // First try Textract's field
                const paymentField = doc.SummaryFields?.find((f: any) => 
                    f.Type?.Text === 'PAYMENT_METHOD' || f.Type?.Text === 'PAYMENT_TERMS'
                );
                
                if (paymentField && paymentField.ValueDetection?.Text) {
                    paymentMethod = paymentField.ValueDetection.Text;
                    console.log(`[Route]   Found payment method (Textract): ${paymentMethod}`);
                } 
                
                // If not found, scan raw OCR blocks (if available via DetectDocumentText)
                const blocks = (result as any).Blocks;
                if (blocks && Array.isArray(blocks)) {
                    const lines = blocks.filter((b: any) => b.BlockType === 'LINE' && b.Text);
                    for (const line of lines) {
                        const text = line.Text.toLowerCase();
                        // "MasterCard 1234", "Visa 1234", "Discover 1234", "Amex 1234"
                        // Or "MasterCard ending in 1234", "Card ... 1234"
                        
                        // Regex to capture Card Type + Last 4 keys
                        const cardMatch = text.match(/(mastercard|visa|discover|amex)[a-z\s]*(\d{4})/);
                        if (cardMatch) {
                            paymentMethod = `${cardMatch[1]} ${cardMatch[2]}`; // e.g. "visa 1234"
                            // Capitalize first letter
                            paymentMethod = paymentMethod.replace(/\b\w/g, c => c.toUpperCase());
                            console.log(`[Route]   Found payment method (Raw Scan): ${paymentMethod}`);
                            break;
                        }
                    }
                }
            }

            // Date (take from first document that has it)
            if (!receiptDate) {
                const dateField = doc.SummaryFields?.find((f: any) => f.Type?.Text === 'INVOICE_RECEIPT_DATE');
                if (dateField) {
                    receiptDate = dateField.ValueDetection?.Text;
                    console.log(`[Route]   Found date: ${receiptDate}`);
                }
            }

            // Parse Line Items from LineItemGroups
            if (doc.LineItemGroups) {
                for (const group of doc.LineItemGroups) {
                    if (group.LineItems) {
                        for (const lineItem of group.LineItems) {
                            const fields = lineItem.LineItemExpenseFields || [];
                            
                            // Extract item name
                            const itemField = fields.find((f: any) => f.Type?.Text === 'ITEM');
                            const priceField = fields.find((f: any) => f.Type?.Text === 'PRICE');
                            const quantityField = fields.find((f: any) => f.Type?.Text === 'QUANTITY');
                            const unitPriceField = fields.find((f: any) => f.Type?.Text === 'UNIT_PRICE');

                            if (itemField?.ValueDetection?.Text && priceField?.ValueDetection?.Text) {
                                const priceStr = priceField.ValueDetection.Text.replace(/[^0-9.]/g, '');
                                const price = priceStr ? Math.round(parseFloat(priceStr) * 100) : 0;
                                
                                let quantity = 1;
                                if (quantityField?.ValueDetection?.Text) {
                                    const qStr = quantityField.ValueDetection.Text.replace(/[^0-9.]/g, '');
                                    quantity = qStr ? parseFloat(qStr) : 1;
                                }

                                let unitPrice: number | undefined;
                                if (unitPriceField?.ValueDetection?.Text) {
                                    const upStr = unitPriceField.ValueDetection.Text.replace(/[^0-9.]/g, '');
                                    unitPrice = upStr ? Math.round(parseFloat(upStr) * 100) : undefined;
                                }

                                const itemName = itemField.ValueDetection.Text.split('\n')[0];
                                console.log(`[Route]   Item: "${itemName}" - $${(price / 100).toFixed(2)}`);

                                lineItems.push({
                                    name: itemName,
                                    price,
                                    quantity,
                                    unitPrice,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Add tax, fees, discounts, tip as separate line items so they show in the table
    if (tax && tax > 0) {
        lineItems.push({ name: 'Tax', price: tax, quantity: 1 });
        console.log(`[Route]   Adding Tax as line item: $${(tax / 100).toFixed(2)}`);
    }
    if (fees && fees > 0) {
        lineItems.push({ name: 'Service/Delivery Fee', price: fees, quantity: 1 });
        console.log(`[Route]   Adding Fees as line item: $${(fees / 100).toFixed(2)}`);
    }
    if (tip && tip > 0) {
        lineItems.push({ name: 'Tip', price: tip, quantity: 1 });
        console.log(`[Route]   Adding Tip as line item: $${(tip / 100).toFixed(2)}`);
    }
    if (discount && discount > 0) {
        // Discounts are negative (reduce total)
        lineItems.push({ name: 'Discount', price: -discount, quantity: 1 });
        console.log(`[Route]   Adding Discount as line item: -$${(discount / 100).toFixed(2)}`);
    }

    // Calculate our own total from all line items
    const calculatedTotal = lineItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    console.log(`[Route] Calculated total from items: $${(calculatedTotal / 100).toFixed(2)}`);
    console.log(`[Route] Extracted total from receipt: $${totalAmount ? (totalAmount / 100).toFixed(2) : 'N/A'}`);
    
    // Check if totals match (within $0.05 tolerance)
    if (totalAmount) {
        const diff = Math.abs(calculatedTotal - totalAmount);
        if (diff > 5) {
            console.log(`[Route] WARNING: Total mismatch of $${(diff / 100).toFixed(2)}!`);
        } else {
            console.log(`[Route] Totals match within tolerance.`);
        }
    }

    console.log(`[Route] Extracted ${lineItems.length} line items (including tax/fees/discounts)`);

    // Categorize items with OpenAI (if we have items and API key)
    let categorizedItems = lineItems.map(item => ({ ...item, cleanName: item.name, category: 'Other' }));
    let metadata = null;
    
    if (lineItems.length > 0 && process.env.OPENAI_API_KEY) {
        console.log('[Route] Sending items to OpenAI for categorization...');
        const result = await categorizeReceiptItems(lineItems);
        categorizedItems = result.items;
        metadata = result.metadata;
        console.log('[Route] OpenAI categorization complete');
    }

    // Store line items in database
    const insertItem = db.prepare(`
      INSERT INTO receipt_items (receipt_id, name, clean_name, price, quantity, unit_price, category_suggestion)
      VALUES (@receipt_id, @name, @clean_name, @price, @quantity, @unit_price, @category_suggestion)
    `);

    for (const item of categorizedItems) {
        insertItem.run({
            receipt_id: receiptId,
            name: item.name,
            clean_name: item.cleanName,
            price: item.price,
            quantity: item.quantity || 1,
            unit_price: item.unitPrice || null,
            category_suggestion: item.category,
        });
    }

    // Construct plain text for DB storage (easier to search than JSON)
    let plainText = '';
    const blocks = (result as any).Blocks;
    if (blocks && Array.isArray(blocks)) {
        plainText = blocks
            .filter((b: any) => b.BlockType === 'LINE' && b.Text)
            .map((b: any) => b.Text)
            .join('\n');
    }

    // Update receipts table
    db.prepare(`
      UPDATE receipts
      SET 
        ocr_text = @ocr_text,
        merchant_name = @merchant_name,
        total_amount = @total_amount,
        receipt_date = @receipt_date,
        confidence_score = @confidence_score,
        payment_method = @payment_method,
        is_processed = 1,
        processing_status = 2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({
      id: receiptId,
      ocr_text: plainText || JSON.stringify(result), // Use plain text if available, else fallback to JSON
      merchant_name: merchantName,
      total_amount: totalAmount,
      receipt_date: receiptDate,
      confidence_score: confidenceScore,
      payment_method: paymentMethod || metadata?.cardUsed || null,
    });

    console.log(`[Route] Receipt ${receiptId} processed successfully with ${categorizedItems.length} items`);

  } catch (error) {
    console.error('Processing error:', error);
    db.prepare(`
      UPDATE receipts
      SET processing_status = 3, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ id: receiptId });
  }
}
