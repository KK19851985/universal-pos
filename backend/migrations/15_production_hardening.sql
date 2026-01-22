-- Production Hardening Migration
-- 1. Money safety: Add integer minor unit columns (cents)
-- 2. Concurrency safety: Add constraints to prevent double-pay and double-seat
-- 3. Idempotency: Add locked_at column for row-level locking

-- ============================================================================
-- MONEY SAFETY: Add integer minor unit columns alongside DECIMAL for transition
-- All amounts stored in cents (minor units) to avoid floating point errors
-- ============================================================================

-- Orders: Add minor unit columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER DEFAULT 0;

-- Order Items: Add minor unit columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price_cents INTEGER DEFAULT 0;

-- Payments: Add minor unit column
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_cents INTEGER DEFAULT 0;

-- Products: Add minor unit columns
ALTER TABLE products ADD COLUMN IF NOT EXISTS base_price_cents INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price_cents INTEGER DEFAULT 0;

-- ============================================================================
-- CONCURRENCY SAFETY: Constraints to prevent double-pay and double-seat
-- ============================================================================

-- First, clean up any duplicate 'seated' statuses (keep only the most recent per table)
DELETE FROM table_statuses 
WHERE id NOT IN (
    SELECT DISTINCT ON (table_id) id 
    FROM table_statuses 
    WHERE status = 'seated'
    ORDER BY table_id, created_at DESC
)
AND status = 'seated';

-- Constraint: Only one active seated status per table at a time
-- A table can only have one "seated" status without a corresponding "available"/"needs_cleaning" after it
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_unique_active_seat 
ON table_statuses (table_id) 
WHERE status = 'seated';

-- Constraint: Only one completed payment per order
-- This prevents double-payment even with different idempotency keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_unique_completed_payment
ON payments (order_id)
WHERE status = 'completed';

-- ============================================================================
-- IDEMPOTENCY RACE-PROOFING: Add locked_at for SELECT FOR UPDATE pattern
-- ============================================================================

ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS locked_by VARCHAR(100);

-- ============================================================================
-- DATA MIGRATION: Convert existing DECIMAL values to cents
-- ============================================================================

-- Convert orders
UPDATE orders SET 
    subtotal_cents = COALESCE(ROUND(subtotal * 100), 0),
    tax_amount_cents = COALESCE(ROUND(tax_amount * 100), 0),
    discount_amount_cents = COALESCE(ROUND(discount_amount * 100), 0),
    service_charge_cents = COALESCE(ROUND(service_charge * 100), 0),
    total_amount_cents = COALESCE(ROUND(total_amount * 100), 0)
WHERE subtotal_cents = 0 OR subtotal_cents IS NULL;

-- Convert order items
UPDATE order_items SET
    unit_price_cents = COALESCE(ROUND(unit_price * 100), 0),
    total_price_cents = COALESCE(ROUND(total_price * 100), 0)
WHERE unit_price_cents = 0 OR unit_price_cents IS NULL;

-- Convert payments
UPDATE payments SET
    amount_cents = COALESCE(ROUND(amount * 100), 0)
WHERE amount_cents = 0 OR amount_cents IS NULL;

-- Convert products
UPDATE products SET
    base_price_cents = COALESCE(ROUND(base_price * 100), 0),
    cost_price_cents = COALESCE(ROUND(cost_price * 100), 0)
WHERE base_price_cents = 0 OR base_price_cents IS NULL;

-- ============================================================================
-- INDEXES FOR CONCURRENCY QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_idempotency_locked ON idempotency_keys(locked_at);

