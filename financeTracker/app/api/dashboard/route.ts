import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get total balance across all accounts
    const balanceResult = db.prepare(`
      SELECT SUM(balance) as total_balance
      FROM accounts
      WHERE is_active = 1
    `).get() as { total_balance: number | null };

    const totalBalance = balanceResult.total_balance || 0;

    // Get account count
    const accountCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM accounts
      WHERE is_active = 1
    `).get() as { count: number };

    // Get recent transactions (last 10)
    const recentTransactions = db.prepare(`
      SELECT 
        t.id,
        t.amount,
        t.transaction_date,
        t.description,
        t.is_expense,
        a.name as account_name,
        c.name as category_name,
        c.icon as category_icon
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 10
    `).all();

    // Get current month's expense and income
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyStats = db.prepare(`
      SELECT 
        SUM(CASE WHEN is_expense = 1 THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN is_expense = 0 THEN amount ELSE 0 END) as total_income,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE strftime('%Y-%m', transaction_date) = @month
    `).get({ month: currentMonth }) as {
      total_expense: number | null;
      total_income: number | null;
      transaction_count: number;
    };

    // Get spending by category (current month)
    const categorySpending = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        SUM(t.amount) as total,
        COUNT(t.id) as count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.is_expense = 1
        AND strftime('%Y-%m', t.transaction_date) = @month
      GROUP BY c.id, c.name, c.icon, c.color
      ORDER BY total DESC
      LIMIT 5
    `).all({ month: currentMonth });

    // Get top accounts by transaction count
    const topAccounts = db.prepare(`
      SELECT 
        a.id,
        a.name,
        a.type,
        a.balance,
        COUNT(t.id) as transaction_count
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      WHERE a.is_active = 1
      GROUP BY a.id, a.name, a.type, a.balance
      ORDER BY transaction_count DESC
      LIMIT 5
    `).all();

    return NextResponse.json({
      totalBalance,
      accountCount: accountCount.count,
      recentTransactions,
      monthly: {
        expense: monthlyStats.total_expense || 0,
        income: monthlyStats.total_income || 0,
        transactionCount: monthlyStats.transaction_count,
        netIncome: (monthlyStats.total_income || 0) - (monthlyStats.total_expense || 0),
      },
      categorySpending,
      topAccounts,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}
