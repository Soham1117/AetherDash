import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { CountryCode, Products } from 'plaid';

export async function POST() {
  try {
    const environment = process.env.PLAID_ENV || 'sandbox';
    console.log(`[Plaid] Creating link token in '${environment}' mode`);

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: `user-${Date.now()}` }, // Use unique ID to reset Link state
      client_name: 'Finance Tracker',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error creating link token:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
