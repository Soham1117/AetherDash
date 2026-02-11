-- Migration 006: Add Plaid Sync Cursor
-- Created: 2026-01-16
-- Description: Add next_cursor column to plaid_connections table for transaction syncing

ALTER TABLE plaid_connections ADD COLUMN next_cursor TEXT NULL;
