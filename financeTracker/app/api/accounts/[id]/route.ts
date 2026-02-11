import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/accounts/[id] - Get single account
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    const account = db.prepare(`
      SELECT id, name, type, currency, balance, is_active, mask, created_at, updated_at
      FROM accounts
      WHERE id = @id
    `).get({ id: accountId });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { error: 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

// PUT /api/accounts/[id] - Update account
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    // Check if account exists
    const existing = db.prepare(`SELECT id FROM accounts WHERE id = @id`).get({ id: accountId });
    if (!existing) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updates: string[] = [];
    const values: Record<string, unknown> = { id: accountId };

    // Build dynamic update
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      updates.push('name = @name');
      values.name = body.name.trim();
    }

    if (body.type !== undefined) {
      const validTypes = ['bank', 'credit_card', 'cash', 'other'];
      if (!validTypes.includes(body.type)) {
        return NextResponse.json(
          { error: `Type must be one of: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
      updates.push('type = @type');
      values.type = body.type;
    }

    if (body.currency !== undefined) {
      updates.push('currency = @currency');
      values.currency = body.currency;
    }

    if (body.balance !== undefined) {
      // Convert from dollars to cents
      const balanceInCents = Math.round(body.balance * 100);
      updates.push('balance = @balance');
      values.balance = balanceInCents;
    }

    if (body.mask !== undefined) {
      updates.push('mask = @mask');
      values.mask = body.mask;
    }

    if (body.is_active !== undefined) {
      updates.push('is_active = @is_active');
      values.is_active = body.is_active ? 1 : 0;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Always update updated_at
    updates.push('updated_at = CURRENT_TIMESTAMP');

    db.prepare(`
      UPDATE accounts
      SET ${updates.join(', ')}
      WHERE id = @id
    `).run(values);

    const updatedAccount = db.prepare(`
      SELECT id, name, type, currency, balance, is_active, mask, created_at, updated_at
      FROM accounts
      WHERE id = @id
    `).get({ id: accountId });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    console.error('Error updating account:', error);

    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'An account with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}

// DELETE /api/accounts/[id] - Delete account
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const accountId = parseInt(id, 10);

    if (isNaN(accountId)) {
      return NextResponse.json(
        { error: 'Invalid account ID' },
        { status: 400 }
      );
    }

    // Check if account exists
    const existing = db.prepare(`SELECT id FROM accounts WHERE id = @id`).get({ id: accountId });
    if (!existing) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check for existing transactions
    // Cascade delete transactions
    db.prepare(`DELETE FROM transactions WHERE account_id = @id`).run({ id: accountId });
    
    // Delete the account
    db.prepare(`DELETE FROM accounts WHERE id = @id`).run({ id: accountId });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
