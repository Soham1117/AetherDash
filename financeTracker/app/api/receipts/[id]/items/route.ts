import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id);

    const items = db.prepare(`
      SELECT 
        id,
        receipt_id,
        name,
        clean_name,
        price,
        quantity,
        unit_price,
        category_id,
        category_suggestion,
        created_at
      FROM receipt_items
      WHERE receipt_id = @receipt_id
      ORDER BY id ASC
    `).all({ receipt_id: receiptId });

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching receipt items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receipt items' },
      { status: 500 }
    );
  }
}
