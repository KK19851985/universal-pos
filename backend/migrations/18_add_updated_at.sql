-- Migration 18: Add missing updated_at columns
-- This adds updated_at columns to tables that need them for discount/void/comp operations

-- Add updated_at to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Also add to orders if missing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
