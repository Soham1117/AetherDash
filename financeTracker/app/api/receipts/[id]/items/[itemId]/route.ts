import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Update a receipt item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { clean_name, price, quantity, category_suggestion } = body;

    const result = db.prepare(`
      UPDATE receipt_items
      SET 
        clean_name = COALESCE(@clean_name, clean_name),
        price = COALESCE(@price, price),
        quantity = COALESCE(@quantity, quantity),
        category_suggestion = COALESCE(@category_suggestion, category_suggestion)
      WHERE id = @id
    `).run({
      id: parseInt(itemId),
      clean_name: clean_name ?? null,
      price: price ?? null,
      quantity: quantity ?? null,
      category_suggestion: category_suggestion ?? null,
    });

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating receipt item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// Delete a receipt item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;

    const result = db.prepare(`
      DELETE FROM receipt_items WHERE id = @id
    `).run({ id: parseInt(itemId) });

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting receipt item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
