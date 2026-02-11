import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/transactions/[id] - Get single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transaction = db.prepare(`
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
    `).get({ id: params.id });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

// PUT /api/transactions/[id] - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const {
      account_id,
      category_id,
      amount,
      transaction_date,
      description,
      notes,
      merchant_name,
      is_expense,
    } = body;

    // Get existing transaction
    const existing = db.prepare(`
      SELECT account_id, amount, is_expense
      FROM transactions
      WHERE id = @id
    `).get({ id: params.id }) as { account_id: number; amount: number; is_expense: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Validation
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
      return NextResponse.json(
        { error: 'Description cannot be empty' },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: Record<string, any> = { id: params.id };

    if (account_id !== undefined) {
      updates.push('account_id = @account_id');
      values.account_id = account_id;
    }
    if (category_id !== undefined) {
      updates.push('category_id = @category_id');
      values.category_id = category_id;
    }
    if (amount !== undefined) {
      updates.push('amount = @amount');
      values.amount = Math.round(amount * 100);
    }
    if (transaction_date !== undefined) {
      updates.push('transaction_date = @transaction_date');
      values.transaction_date = transaction_date;
    }
    if (description !== undefined) {
      updates.push('description = @description');
      values.description = description.trim();
    }
    if (notes !== undefined) {
      updates.push('notes = @notes');
      values.notes = notes;
    }
    if (merchant_name !== undefined) {
      updates.push('merchant_name = @merchant_name');
      values.merchant_name = merchant_name;
    }
    if (is_expense !== undefined) {
      updates.push('is_expense = @is_expense');
      values.is_expense = is_expense;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Update transaction and adjust account balances
    const updateTransaction = db.transaction(() => {
      // Reverse old balance change
      const oldBalanceChange = existing.is_expense ? -existing.amount : existing.amount;
      db.prepare(`
        UPDATE accounts
        SET balance = balance - @change,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @account_id
      `).run({ change: oldBalanceChange, account_id: existing.account_id });

      // Update transaction
      db.prepare(`
        UPDATE transactions
        SET ${updates.join(', ')}
        WHERE id = @id
      `).run(values);

      // Apply new balance change
      const newAmount = values.amount !== undefined ? values.amount : existing.amount;
      const newIsExpense = values.is_expense !== undefined ? values.is_expense : existing.is_expense;
      const newAccountId = values.account_id !== undefined ? values.account_id : existing.account_id;
      const newBalanceChange = newIsExpense ? -newAmount : newAmount;

      db.prepare(`
        UPDATE accounts
        SET balance = balance + @change,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @account_id
      `).run({ change: newBalanceChange, account_id: newAccountId });
    });

    updateTransaction();

    // Fetch updated transaction
    const updatedTransaction = db.prepare(`
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
    `).get({ id: params.id });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}

// DELETE /api/transactions/[id] - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get transaction details before deletion
    const transaction = db.prepare(`
      SELECT account_id, amount, is_expense
      FROM transactions
      WHERE id = @id
    `).get({ id: params.id }) as { account_id: number; amount: number; is_expense: number } | undefined;

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Delete transaction and reverse balance change
    const deleteTransaction = db.transaction(() => {
      // Reverse balance change
      const balanceChange = transaction.is_expense ? -transaction.amount : transaction.amount;
      db.prepare(`
        UPDATE accounts
        SET balance = balance - @change,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @account_id
      `).run({ change: balanceChange, account_id: transaction.account_id });

      // Delete transaction
      db.prepare('DELETE FROM transactions WHERE id = @id').run({ id: params.id });
    });

    deleteTransaction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    );
  }
}
