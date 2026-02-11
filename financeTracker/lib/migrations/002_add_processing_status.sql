-- Migration 002: Add processing_status to receipts table for background OCR processing
-- Status values: 'pending' (0), 'processing' (1), 'completed' (2), 'failed' (3)

-- Add processing_status column (using INTEGER for compatibility, 0=pending, 1=processing, 2=completed, 3=failed)
-- SQLite requires DEFAULT value when adding NOT NULL column
ALTER TABLE receipts ADD COLUMN processing_status INTEGER DEFAULT 0;

-- Update existing records: is_processed=1 means completed (2), is_processed=0 means pending (0)
UPDATE receipts SET processing_status = CASE WHEN is_processed = 1 THEN 2 ELSE 0 END;

-- Create index for querying receipts by processing status
CREATE INDEX IF NOT EXISTS idx_receipts_processing_status ON receipts(processing_status);
