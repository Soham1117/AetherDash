-- Migration 004: Receipt Line Items
-- Created: 2026-01-15
-- Description: Store individual line items extracted from receipts

CREATE TABLE IF NOT EXISTS receipt_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Original item name from receipt
  clean_name TEXT NULL, -- Cleaned/normalized name from OpenAI
  price INTEGER NOT NULL, -- Price in paise/cents
  quantity REAL NOT NULL DEFAULT 1.0,
  unit_price INTEGER NULL, -- Unit price if available
  category_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
  category_suggestion TEXT NULL, -- OpenAI's suggested category name (before linking)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fetching items by receipt
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);

-- Index for category analysis
CREATE INDEX IF NOT EXISTS idx_receipt_items_category ON receipt_items(category_id);
