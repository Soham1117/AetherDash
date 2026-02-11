import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/accounts - List all accounts
export async function GET() {
  try {
    const accounts = db.prepare(`
      SELECT id, name, type, currency, balance, is_active, mask, created_at, updated_at
      FROM accounts
      ORDER BY name ASC
    `).all();

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

// POST /api/accounts - Create new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, currency = 'USD', balance = 0, mask } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const validTypes = ['bank', 'credit_card', 'cash', 'other'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Convert balance from dollars to cents
    const balanceInCents = Math.round(balance * 100);

    const result = db.prepare(`
      INSERT INTO accounts (name, type, currency, balance, mask, is_active)
      VALUES (@name, @type, @currency, @balance, @mask, 1)
    `).run({
      name: name.trim(),
      type,
      currency,
      balance: balanceInCents,
      mask: mask || null,
    });

    const newAccount = db.prepare(`
      SELECT id, name, type, currency, balance, is_active, mask, created_at, updated_at
      FROM accounts
      WHERE id = @id
    `).get({ id: result.lastInsertRowid });

    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('Error creating account:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'An account with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
