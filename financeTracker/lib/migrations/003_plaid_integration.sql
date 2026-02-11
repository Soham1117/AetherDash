-- Migration 003: Plaid Integration
-- Created: 2026-01-15
-- Description: Tables for Plaid connections and mapping accounts

-- ============================================================================
-- PLAID CONNECTIONS TABLE
-- ============================================================================
-- Stores the credentials and status for a connected institution (Item)

CREATE TABLE IF NOT EXISTS plaid_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL UNIQUE, -- Plaid's unique identifier for the connection
  access_token TEXT NOT NULL, -- The token used to fetch data (store securely!)
  institution_id TEXT NOT NULL, -- e.g., 'ins_3' for Chase
  institution_name TEXT NOT NULL, -- e.g., 'Chase'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'error', 'disconnected'
  error_code TEXT NULL, -- Last error reported by Plaid
  last_synced_at TEXT NULL, -- Timestamp of last successful sync
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACCOUNT UPDATES
-- ============================================================================
-- Link local accounts to their Plaid counterparts

ALTER TABLE accounts ADD COLUMN plaid_connection_id INTEGER NULL REFERENCES plaid_connections(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN plaid_account_id TEXT NULL; -- Plaid's account_id (string)

-- Index for looking up accounts by their Plaid ID (for syncing)
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_id ON accounts(plaid_account_id);
