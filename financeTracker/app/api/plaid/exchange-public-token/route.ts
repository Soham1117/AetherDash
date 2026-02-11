import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { public_token, institution_id, institution_name } = body;

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Save connection to DB
    const insertResult = db.prepare(`
        INSERT INTO plaid_connections (item_id, access_token, institution_id, institution_name)
        VALUES (@item_id, @access_token, @institution_id, @institution_name)
    `).run({
        item_id: itemId,
        access_token: accessToken,
        institution_id: institution_id || 'unknown',
        institution_name: institution_name || 'Unknown Bank',
    });

    const connectionId = insertResult.lastInsertRowid;

    // Fetch accounts
    const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
    });

    // Save accounts to DB
    const insertAccount = db.prepare(`
        INSERT INTO accounts (name, type, currency, balance, plaid_connection_id, plaid_account_id)
        VALUES (@name, @type, @currency, @balance, @plaid_connection_id, @plaid_account_id)
    `);

    let createdAccounts: any[] = [];

    for (const account of accountsResponse.data.accounts) {
        // Map Plaid types to our types
        let type = 'other';
        if (account.type === 'depository') type = 'bank';
        else if (account.type === 'credit') type = 'credit_card';
        // Force valid types if not matched
        const validTypes = ['bank', 'credit_card', 'cash', 'other'];
        if (!validTypes.includes(type)) type = 'other';

        const balance = Math.round((account.balances.current || 0) * 100); // Convert to minor units (cents/paise)

        try {
             const result = insertAccount.run({
                name: account.name, 
                type,
                currency: account.balances.iso_currency_code || 'USD',
                balance,
                plaid_connection_id: connectionId,
                plaid_account_id: account.account_id,
            });
            createdAccounts.push({ id: result.lastInsertRowid, ...account });
        } catch (e) {
            console.error(`Failed to insert account ${account.name}:`, e);
             // Try appending 4 chars of ID to make generic names unique?
             try {
                const result = insertAccount.run({
                    name: `${account.name} (${account.account_id.slice(-4)})`,
                    type,
                    currency: account.balances.iso_currency_code || 'USD',
                    balance,
                    plaid_connection_id: connectionId,
                    plaid_account_id: account.account_id,
                });
                createdAccounts.push({ id: result.lastInsertRowid, ...account });
             } catch (retryError) {
                 console.error(`Failed to insert account ${account.name} even with suffix:`, retryError);
             }
        }
    }

    return NextResponse.json({ success: true, accounts: createdAccounts });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
