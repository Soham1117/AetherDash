import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id);

    const receipt = db.prepare(`
      SELECT *
      FROM receipts
      WHERE id = @id
    `).get({ id: receiptId });

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(receipt);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return NextResponse.json(
      { error: 'Failed to fetch receipt' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const receiptId = parseInt(id);

    // Get receipt from database
    const receipt = db.prepare(`
      SELECT id, image_path, transaction_id
      FROM receipts
      WHERE id = @id
    `).get({ id: receiptId }) as {
      id: number;
      image_path: string;
      transaction_id: number | null;
    } | undefined;

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 }
      );
    }

    // Check if receipt is linked to a transaction
    if (receipt.transaction_id) {
      return NextResponse.json(
        { error: 'Cannot delete receipt that is linked to a transaction. Delete the transaction first.' },
        { status: 400 }
      );
    }

    // Delete the image file
    const imagePath = path.join(process.cwd(), receipt.image_path);
    if (existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (error) {
        console.error('Error deleting image file:', error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    db.prepare(`
      DELETE FROM receipts
      WHERE id = @id
    `).run({ id: receiptId });

    return NextResponse.json({
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 }
    );
  }
}
