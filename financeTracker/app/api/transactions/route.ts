import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/transactions - List transactions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const categoryId = searchParams.get('category_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const isExpense = searchParams.get('is_expense');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query dynamically
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    if (accountId) {
      conditions.push('t.account_id = @account_id');
      params.account_id = accountId;
    }

    if (categoryId) {
      conditions.push('t.category_id = @category_id');
      params.category_id = categoryId;
    }

    if (startDate) {
      conditions.push('t.transaction_date >= @start_date');
      params.start_date = startDate;
    }

    if (endDate) {
      conditions.push('t.transaction_date <= @end_date');
      params.end_date = endDate;
    }

    if (isExpense !== null) {
      conditions.push('t.is_expense = @is_expense');
      params.is_expense = isExpense === '1' ? 1 : 0;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const transactions = db.prepare(`
      SELECT 
        t.id,
        t.account_id,
        t.category_id,
        t.amount,
        t.transaction_date,
        t.description,
        t.notes,
        t.merchant_name,
        t.source,
        t.is_expense,
        t.created_at,
        t.updated_at,
        a.name as account_name,
        a.type as account_type,
        c.name as category_name,
        c.icon as category_icon,
        c.color as category_color
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause}
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit, offset });

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM transactions t
      ${whereClause}
    `).get(params) as { total: number };

    return NextResponse.json({
      transactions,
      total: countResult.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST /api/transactions - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      account_id,
      category_id = null,
      amount,
      transaction_date,
      description,
      notes = null,
      merchant_name = null,
      source = 'manual',
      is_expense = 1,
    } = body;

    // Validation
    if (!account_id || typeof account_id !== 'number') {
      return NextResponse.json(
        { error: 'Valid account_id is required' },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (!transaction_date || typeof transaction_date !== 'string') {
      return NextResponse.json(
        { error: 'Transaction date is required' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Verify account exists
    const account = db.prepare('SELECT id FROM accounts WHERE id = @id').get({ id: account_id });
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Verify category exists if provided
    if (category_id) {
      const category = db.prepare('SELECT id FROM categories WHERE id = @id').get({ id: category_id });
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 }
        );
      }
    }

    // Convert amount from rupees to paise
    const amountInPaise = Math.round(amount * 100);

    // Start transaction
    const insertTransaction = db.transaction(() => {
      // Insert transaction
      const result = db.prepare(`
        INSERT INTO transactions (
          account_id, category_id, amount, transaction_date, description,
          notes, merchant_name, source, is_expense, receipt_id
        )
        VALUES (
          @account_id, @category_id, @amount, @transaction_date, @description,
          @notes, @merchant_name, @source, @is_expense, @receipt_id
        )
      `).run({
        account_id,
        category_id,
        amount: amountInPaise,
        transaction_date,
        description: description.trim(),
        notes,
        merchant_name,
        source,
        is_expense,
        receipt_id: body.receipt_id || null,
      });

      const transactionId = result.lastInsertRowid;

      // Update account balance
      const balanceChange = is_expense ? -amountInPaise : amountInPaise;
      db.prepare(`
        UPDATE accounts
        SET balance = balance + @change,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @account_id
      `).run({ change: balanceChange, account_id });

      // Link receipt if provided
      if (body.receipt_id) {
        db.prepare(`
          UPDATE receipts
          SET transaction_id = @transaction_id,
              is_processed = 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = @receipt_id
        `).run({ transaction_id: transactionId, receipt_id: body.receipt_id });
      }

      // Insert line items if provided
      if (body.line_items && Array.isArray(body.line_items)) {
        const insertItem = db.prepare(`
          INSERT INTO transaction_line_items (
            parent_transaction_id, description, amount, quantity
          ) VALUES (
            @parent_id, @description, @amount, @quantity
          )
        `);

        for (const item of body.line_items) {
          // Calculate individual item amount in paise
          // Assuming item.price is in paise from the receipt item
          let itemAmount = item.price; 
          // If price looks small (e.g. 5.99 instead of 599), treat as rupees and convert
          // BUT our receipt items are stored in paise (integer), so we trust they are integers.
          
          insertItem.run({
            parent_id: transactionId,
            description: item.name || item.description,
            amount: itemAmount,
            quantity: item.quantity || 1,
          });
        }
      }

      return transactionId;
    });

    const transactionId = insertTransaction();

    // Fetch the created transaction with joined data
    const newTransaction = db.prepare(`
      SELECT 
        t.id,
        t.account_id,
        t.category_id,
        t.amount,
        t.transaction_date,
        t.description,
        t.notes,
        t.merchant_name,
        t.source,
        t.is_expense,
        t.created_at,
        t.updated_at,
        a.name as account_name,
        c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = @id
    `).get({ id: transactionId });

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
