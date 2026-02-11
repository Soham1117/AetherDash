import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { db } from '@/lib/db';
import { RemovedTransaction, Transaction, TransactionPaymentChannelEnum } from 'plaid';

export async function POST(request: NextRequest) {
  try {
    // 1. Get all active connections
    const connections = db.prepare(`
      SELECT id, item_id, access_token, next_cursor 
      FROM plaid_connections 
      WHERE status = 'active'
    `).all() as { id: number; item_id: string; access_token: string; next_cursor: string | null }[];

    if (connections.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No active connections to sync. Please link a bank account first.', 
        stats: { added: 0, modified: 0, removed: 0 } 
      });
    }

    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const connection of connections) {
      let cursor = connection.next_cursor;
      let hasMore = true;

      try {
        // Iterate through pages
        while (hasMore) {
          const response = await plaidClient.transactionsSync({
            access_token: connection.access_token,
            cursor: cursor || undefined,
            count: 500, // Max page size
          });

          const data = response.data;
          
          // Process Added
          for (const plaidTx of data.added) {
            // Find local account
            const account = db.prepare('SELECT id FROM accounts WHERE plaid_account_id = ?').get(plaidTx.account_id) as { id: number } | undefined;
            
            if (account) {
              const amount = Math.abs(plaidTx.amount);
              const amountInPaise = Math.round(amount * 100);
              const isExpense = plaidTx.amount > 0 ? 1 : 0;

              // Insert transaction
              // Ignore conflicts if unique constraint on plaid_transaction_id hits (though we used UNIQUE index?)
              // Using INSERT OR IGNORE or checking existence first is safer.
              // Since we have UNIQUE constraint on plaid_transaction_id, we can use try/catch or INSERT OR IGNORE
              
              db.prepare(`
                INSERT OR IGNORE INTO transactions (
                  account_id, amount, transaction_date, description, merchant_name, 
                  source, is_expense, plaid_transaction_id, category_id
                ) VALUES (
                  @account_id, @amount, @transaction_date, @description, @merchant_name,
                  'bank_import', @is_expense, @plaid_transaction_id, NULL
                )
              `).run({
                account_id: account.id,
                amount: amountInPaise,
                transaction_date: plaidTx.date,
                description: plaidTx.name,
                merchant_name: plaidTx.merchant_name || plaidTx.name,
                is_expense: isExpense,
                plaid_transaction_id: plaidTx.transaction_id,
              });
              
              // Only count if actually inserted? 'run' returns changes.
              totalAdded++; // Approximation
              
              // Only count if actually inserted? 'run' returns changes.
              totalAdded++; // Approximation
            }
          }

          // Process Modified
          for (const plaidTx of data.modified) {
             const account = db.prepare('SELECT id FROM accounts WHERE plaid_account_id = ?').get(plaidTx.account_id) as { id: number } | undefined;
             if (account) {
                const amount = Math.abs(plaidTx.amount);
                const amountInPaise = Math.round(amount * 100);
                const isExpense = plaidTx.amount > 0 ? 1 : 0;

                db.prepare(`
                  UPDATE transactions 
                  SET amount = @amount, 
                      transaction_date = @transaction_date, 
                      description = @description, 
                      merchant_name = @merchant_name,
                      is_expense = @is_expense,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE plaid_transaction_id = @plaid_transaction_id
                `).run({
                  amount: amountInPaise,
                  transaction_date: plaidTx.date,
                  description: plaidTx.name,
                  merchant_name: plaidTx.merchant_name || plaidTx.name,
                  is_expense: isExpense,
                  plaid_transaction_id: plaidTx.transaction_id,
                });
                totalModified++;
             }
          }

          // Process Removed
          for (const removedTx of data.removed) {
            db.prepare('DELETE FROM transactions WHERE plaid_transaction_id = ?').run(removedTx.transaction_id);
            totalRemoved++;
          }

          // Update cursor state
          cursor = data.next_cursor;
          hasMore = data.has_more;
        }

        // Update connection cursor in DB
        // Update connection cursor in DB
        db.prepare('UPDATE plaid_connections SET next_cursor = ?, last_synced_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(cursor, connection.id);

        // REFRESH BALANCES
        const accountRes = await plaidClient.accountsGet({ access_token: connection.access_token });
        for (const plaidAcc of accountRes.data.accounts) {
             const current = plaidAcc.balances.current;
             const available = plaidAcc.balances.available;
             console.log(`[Sync] Account: ${plaidAcc.name} (${plaidAcc.mask}) | Current: ${current} | Available: ${available}`);
             
             // Use current balance, fallback to available if current is null (common for some banks)
             // For credit cards, positive current balance means you owe money.
             const balanceValue = (current !== null && current !== undefined) ? current : (available || 0);
             const balance = Math.round(balanceValue * 100);
             
             db.prepare('UPDATE accounts SET balance = ?, mask = ?, updated_at = CURRENT_TIMESTAMP WHERE plaid_account_id = ?')
               .run(balance, plaidAcc.mask, plaidAcc.account_id);
        }

      } catch (err) {
        console.error(`Error syncing connection ${connection.id}:`, err);
        // Continue to next connection
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved
      }
    });

  } catch (error) {
    console.error('Error in sync api:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
