import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('receipt') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (images and PDFs)
    const allowedTypes = [
      'image/jpeg', 
      'image/jpg', 
      'image/png', 
      'image/webp',
      'application/pdf'
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP images, and PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB for PDFs, 10MB for images)
    const isPdf = file.type === 'application/pdf';
    const maxSize = isPdf ? 20 * 1024 * 1024 : 10 * 1024 * 1024; // 20MB for PDFs, 10MB for images
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Create receipts directory if it doesn't exist
    const receiptsDir = path.join(process.cwd(), 'data', 'receipts');
    if (!existsSync(receiptsDir)) {
      await mkdir(receiptsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `receipt_${timestamp}.${extension}`;
    const filepath = path.join(receiptsDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Create receipt record in database
    const result = db.prepare(`
      INSERT INTO receipts (image_path, is_processed)
      VALUES (@image_path, 0)
    `).run({
      image_path: `data/receipts/${filename}`,
    });

    const receipt = db.prepare(`
      SELECT id, image_path, is_processed, created_at
      FROM receipts
      WHERE id = @id
    `).get({ id: result.lastInsertRowid }) as {
      id: number;
      image_path: string;
      is_processed: number;
      created_at: string;
    };

    return NextResponse.json({
      id: receipt.id,
      image_path: receipt.image_path,
      is_processed: receipt.is_processed,
      created_at: receipt.created_at,
      message: 'Receipt uploaded successfully. OCR processing will be available soon.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading receipt:', error);
    return NextResponse.json(
      { error: 'Failed to upload receipt' },
      { status: 500 }
    );
  }
}

// GET /api/receipts - List all receipts
export async function GET() {
  try {
    const receipts = db.prepare(`
      SELECT 
        r.id,
        r.image_path,
        r.ocr_text,
        r.merchant_name,
        r.total_amount,
        r.receipt_date,
        r.confidence_score,
        r.is_processed,
        r.transaction_id,
        r.created_at,
        t.description as transaction_description
      FROM receipts r
      LEFT JOIN transactions t ON r.transaction_id = t.id
      ORDER BY r.created_at DESC
    `).all();

    return NextResponse.json(receipts);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receipts' },
      { status: 500 }
    );
  }
}
