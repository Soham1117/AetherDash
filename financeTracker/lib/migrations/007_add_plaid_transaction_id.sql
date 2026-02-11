-- Migration 007: Add Plaid Transaction ID
-- Created: 2026-01-16
-- Description: Add plaid_transaction_id to transactions table for syncing

ALTER TABLE transactions ADD COLUMN plaid_transaction_id TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id);
