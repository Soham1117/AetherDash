import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id);

    // Get receipt status from database
    const receipt = db.prepare(`
      SELECT 
        id,
        is_processed,
        processing_status,
        ocr_text,
        merchant_name,
        total_amount,
        receipt_date,
        confidence_score,
        parsed_data,
        updated_at
      FROM receipts
      WHERE id = @id
    `).get({ id: receiptId }) as {
      id: number;
      is_processed: number;
      processing_status: number;
      ocr_text: string | null;
      merchant_name: string | null;
      total_amount: number | null;
      receipt_date: string | null;
      confidence_score: number | null;
      parsed_data: string | null;
      updated_at: string;
    } | undefined;

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Map processing_status: 0=pending, 1=processing, 2=completed, 3=failed
    const statusMap: Record<number, string> = {
      0: 'pending',
      1: 'processing',
      2: 'completed',
      3: 'failed',
    };

    return NextResponse.json({
      id: receipt.id,
      status: statusMap[receipt.processing_status] || 'unknown',
      is_processed: receipt.is_processed === 1,
      ...(receipt.processing_status === 2 && {
        ocr_text: receipt.ocr_text,
        merchant_name: receipt.merchant_name,
        total_amount: receipt.total_amount,
        receipt_date: receipt.receipt_date,
        confidence_score: receipt.confidence_score,
        parsed_data: receipt.parsed_data ? JSON.parse(receipt.parsed_data) : null,
      }),
      updated_at: receipt.updated_at,
    });
  } catch (error) {
    console.error('Error getting receipt status:', error);
    return NextResponse.json(
      { error: 'Failed to get receipt status' },
      { status: 500 }
    );
  }
}
