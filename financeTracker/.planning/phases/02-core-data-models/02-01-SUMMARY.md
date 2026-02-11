---
phase: 02-core-data-models
plan: 01
subsystem: database
tags: [sqlite, schema, migrations, data-modeling]

# Dependency graph
requires:
  - phase: 01-foundation-setup-02
    provides: SQLite database integration with version tracking
provides:
  - Accounts table for bank/credit card/cash tracking
  - Categories table with unlimited hierarchy depth
  - Transactions table with source attribution
  - Migration file ready for database initialization
affects: [02-core-data-models-02, 03-manual-entry-system, all-transaction-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [money-as-integers, hierarchical-categories, source-tracking]

key-files:
  created: [lib/migrations/001_core_schema.sql]
  modified: []

key-decisions:
  - "Money stored as INTEGER in paise to avoid floating point precision issues"
  - "Categories support unlimited nesting via self-referencing foreign key"
  - "Transactions track source (manual, receipt_ocr, bank_import, cc_bill) for Phase 5 duplicate detection"
  - "Four performance indexes on transactions for common query patterns"

patterns-established:
  - "Money amounts: Always INTEGER in smallest currency unit (paise for INR)"
  - "Booleans: INTEGER with 1=true, 0=false (SQLite convention)"
  - "Timestamps: TEXT with CURRENT_TIMESTAMP default, ISO8601 format"
  - "Hierarchy: Self-referencing FK with ON DELETE CASCADE"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-09
---

# Phase 2 Plan 1: Core Financial Schema Summary

**Foundation database schema with accounts, hierarchical categories, and transactions tables optimized for expense tracking and duplicate detection**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-09T13:06:00Z
- **Completed:** 2026-01-09T13:09:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Created migration file with three foundational tables
- Accounts table supports bank, credit card, cash, and other account types
- Categories table enables unlimited hierarchy depth (Groceries > Food > Vegetables)
- Transactions table links accounts and categories with source tracking for duplicate detection
- Four performance indexes on transactions table for common query patterns
- All money stored as integers in paise to eliminate floating point precision issues

## Task Commits

Each task was committed atomically:

1. **Task 1: Create accounts table** - `b8cf20d` (feat)
2. **Task 2: Create categories table with hierarchy** - `f54e2b6` (feat)
3. **Task 3: Create transactions table with source tracking** - `baf56c6` (feat)

**Plan metadata:** (pending - this commit)

## Files Created/Modified

- `lib/migrations/001_core_schema.sql` - Complete schema migration with 3 tables, constraints, and indexes

## Decisions Made

**Money as integers in smallest unit:**
- Storing amounts as INTEGER in paise (100.50 INR = 10050) avoids floating point precision issues
- This is critical for financial calculations where exactness is required
- Pattern applies to all money fields (account balance, transaction amount, etc.)

**Hierarchical categories:**
- Self-referencing foreign key (parent_id) enables unlimited nesting depth
- UNIQUE constraint on (name, parent_id) prevents duplicate subcategories under same parent
- ON DELETE CASCADE automatically removes child categories when parent is deleted
- Supports future auto-categorization with system-created categories (is_system flag)

**Source tracking on transactions:**
- Every transaction records its origin (manual, receipt_ocr, bank_import, cc_bill)
- Enables Phase 5 duplicate detection to match same purchase across sources
- merchant_name field provides normalized merchant identifier for fuzzy matching

**Performance indexes:**
- (account_id, transaction_date DESC) for account history queries
- (category_id, transaction_date DESC) for category spending reports
- (merchant_name) for duplicate detection lookups
- (transaction_date DESC) for timeline views

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward SQL schema design with no complications.

## Next Phase Readiness

**Ready for 02-02-PLAN.md (Advanced Tracking Schema)**

Core financial entities established. Phase 2 Plan 2 can now add:
- Receipts and line items tables (builds on transactions)
- Transaction links table (builds on transactions)
- Attachments table (builds on transactions and receipts)

No blockers.

---
*Phase: 02-core-data-models*
*Completed: 2026-01-09*
