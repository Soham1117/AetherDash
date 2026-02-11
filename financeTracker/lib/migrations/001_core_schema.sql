-- Migration 001: Core Financial Schema
-- Created: 2026-01-09
-- Description: Foundational tables for accounts, categories, and transactions

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
-- Stores bank accounts, credit cards, cash wallets, and other financial accounts
-- Money stored as INTEGER in smallest currency unit (paise for INR) to avoid floating point issues

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('bank', 'credit_card', 'cash', 'other')),
  currency TEXT NOT NULL DEFAULT 'INR',
  balance INTEGER NOT NULL DEFAULT 0, -- Stored in paise (100.50 INR = 10050)
  is_active INTEGER NOT NULL DEFAULT 1, -- 1=active, 0=inactive
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for filtering by account type
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- ============================================================================
-- CATEGORIES TABLE
-- ============================================================================
-- Hierarchical category system for expense/income classification
-- Self-referencing foreign key enables unlimited nesting (e.g., Groceries > Food > Vegetables)

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id INTEGER NULL REFERENCES categories(id) ON DELETE CASCADE,
  icon TEXT NULL, -- Emoji or icon name
  color TEXT NULL, -- Hex color code
  is_system INTEGER NOT NULL DEFAULT 0, -- 1=system category (prevent deletion), 0=user-created
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, parent_id) -- Prevent duplicate subcategories under same parent
);

-- Index for hierarchy queries (fetching children of a parent)
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
-- Core transaction log for all financial activity
-- Tracks expenses and income with source attribution for duplicate detection

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER NULL REFERENCES categories(id), -- NULL for uncategorized
  amount INTEGER NOT NULL, -- Always positive, in paise
  transaction_date TEXT NOT NULL, -- ISO8601 format for sorting
  description TEXT NOT NULL,
  notes TEXT NULL,
  merchant_name TEXT NULL, -- Normalized for duplicate detection matching
  source TEXT NOT NULL CHECK (source IN ('manual', 'receipt_ocr', 'bank_import', 'cc_bill')),
  receipt_id INTEGER NULL, -- Foreign key added in Phase 4
  is_expense INTEGER NOT NULL, -- 1=expense, 0=income
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category_date ON transactions(category_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_name);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);

-- ============================================================================
-- RECEIPTS TABLE
-- ============================================================================
-- OCR-captured receipt data for Phase 4 integration
-- Links to transaction once processed, tracks OCR confidence

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE SET NULL, -- NULL if not yet converted
  image_path TEXT NULL, -- Local file path to receipt image
  ocr_text TEXT NULL, -- Raw OCR output for debugging
  merchant_name TEXT NULL, -- Extracted merchant name
  total_amount INTEGER NULL, -- Extracted amount in paise
  receipt_date TEXT NULL, -- Extracted date (ISO8601)
  confidence_score REAL NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0), -- OCR confidence 0.0-1.0
  is_processed INTEGER NOT NULL DEFAULT 0, -- 1=converted to transaction, 0=pending
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for unprocessed receipt queue
CREATE INDEX IF NOT EXISTS idx_receipts_is_processed ON receipts(is_processed);

-- ============================================================================
-- TRANSACTION LINE ITEMS TABLE
-- ============================================================================
-- Line-item breakdown for credit card bills and multi-item receipts
-- Optional link to original transaction (for duplicate detection)

CREATE TABLE IF NOT EXISTS transaction_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE, -- The CC bill or receipt
  child_transaction_id INTEGER NULL REFERENCES transactions(id) ON DELETE SET NULL, -- The individual purchase (if logged separately)
  description TEXT NOT NULL,
  amount INTEGER NOT NULL, -- In paise
  quantity REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for bill breakdown queries (fetch all line items of a CC bill)
CREATE INDEX IF NOT EXISTS idx_line_items_parent ON transaction_line_items(parent_transaction_id);

-- ============================================================================
-- TRANSACTION LINKS TABLE
-- ============================================================================
-- Relationships between transactions for duplicate detection (Phase 5)
-- Expresses "Transaction A is duplicate_of Transaction B"

CREATE TABLE IF NOT EXISTS transaction_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_a_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  transaction_b_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('duplicate_of', 'payment_for', 'refund_of', 'split_from')),
  relationship_metadata TEXT NULL, -- JSON: {confidence: 0.95, method: "fuzzy_match", matched_fields: ["amount", "merchant"]}
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_a_id, transaction_b_id, link_type) -- Prevent duplicate links
);

-- Indexes for bidirectional lookup (find all links for transaction X)
CREATE INDEX IF NOT EXISTS idx_links_transaction_a ON transaction_links(transaction_a_id);
CREATE INDEX IF NOT EXISTS idx_links_transaction_b ON transaction_links(transaction_b_id);

-- ============================================================================
-- ATTACHMENTS TABLE
-- ============================================================================
-- File storage tracking for receipts, bills, and transaction documents
-- Supports multiple attachments per entity (multiple photos, PDFs)

CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('transaction', 'receipt')),
  entity_id INTEGER NOT NULL, -- Foreign key to transaction or receipt (polymorphic)
  file_path TEXT NOT NULL, -- Relative path in data/ directory
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'other')),
  file_size INTEGER NULL, -- File size in bytes
  mime_type TEXT NULL, -- MIME type (image/jpeg, application/pdf, etc.)
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fetching all attachments for an entity
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
