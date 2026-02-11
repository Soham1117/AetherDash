-- Migration 005: Add Payment Method to Receipts
-- Created: 2026-01-16
-- Description: Add payment_method column to receipts table

ALTER TABLE receipts ADD COLUMN payment_method TEXT NULL;
