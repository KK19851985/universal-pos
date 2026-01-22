-- Phase 1: Order Operations + Permissions Migration
-- Adds void/discount/comp functionality with role-based permissions

-- ============================================================================
-- PERMISSION SYSTEM
-- ============================================================================

-- Add permissions column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Update existing admin user with all permissions
UPDATE users SET permissions = '{
    "void_item": true,
    "discount_item": true,
    "comp_item": true,
    "order_discount": true,
    "manager_override": true,
    "view_reports": true,
    "manage_users": true
}'::jsonb WHERE role = 'admin';

-- ============================================================================
-- VOID REASONS LOOKUP TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS void_reasons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    requires_manager BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed common void reasons
INSERT INTO void_reasons (code, description, requires_manager) VALUES
    ('customer_request', 'Customer requested removal', false),
    ('wrong_item', 'Wrong item ordered', false),
    ('quality_issue', 'Quality/preparation issue', false),
    ('duplicate', 'Duplicate entry', false),
    ('out_of_stock', 'Item out of stock', false),
    ('allergy', 'Allergy/dietary concern', false),
    ('pricing_error', 'Pricing error correction', true),
    ('manager_comp', 'Manager comp/courtesy', true),
    ('other', 'Other (specify)', false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- DISCOUNT TYPES LOOKUP TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value DECIMAL(10,2) NOT NULL,
    max_value_cents INTEGER, -- cap for percentage discounts
    requires_manager BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed common discount types
INSERT INTO discount_types (code, name, type, value, requires_manager) VALUES
    ('happy_hour', 'Happy Hour 10%', 'percentage', 10.00, false),
    ('senior', 'Senior Discount 15%', 'percentage', 15.00, false),
    ('employee', 'Employee Discount 20%', 'percentage', 20.00, false),
    ('loyalty', 'Loyalty Member 5%', 'percentage', 5.00, false),
    ('comp_5', 'Comp $5', 'fixed_amount', 5.00, false),
    ('comp_10', 'Comp $10', 'fixed_amount', 10.00, true),
    ('manager_50', 'Manager 50% Off', 'percentage', 50.00, true),
    ('full_comp', 'Full Comp 100%', 'percentage', 100.00, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- ORDER ITEMS VOID/COMP COLUMNS
-- ============================================================================

-- Void tracking columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES users(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS void_reason_id INTEGER REFERENCES void_reasons(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS void_reason_text TEXT;

-- Comp tracking columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_comped BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS comped_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS comped_by INTEGER REFERENCES users(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS comp_reason TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS comp_approved_by INTEGER REFERENCES users(id);

-- ============================================================================
-- DISCOUNT APPLICATIONS TABLE (APPEND-ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_applications (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    order_item_id INTEGER REFERENCES order_items(id), -- NULL = order-level discount
    discount_type_id INTEGER REFERENCES discount_types(id),
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL, -- percentage or fixed amount
    discount_amount_cents INTEGER NOT NULL, -- calculated discount amount
    original_amount_cents INTEGER NOT NULL, -- amount before discount
    reason TEXT,
    applied_by INTEGER NOT NULL REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id), -- manager approval if required
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate discounts per item
    UNIQUE(order_item_id) -- only one discount per item (can be NULL for order-level)
);

-- Create partial unique index for order-level discounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_one_per_order 
ON discount_applications (order_id) 
WHERE order_item_id IS NULL;

-- ============================================================================
-- ORDER-LEVEL DISCOUNT/SERVICE CHARGE COLUMNS
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_charge_rate_bps INTEGER DEFAULT 0; -- basis points

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_voided ON order_items(voided_at) WHERE voided_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_comped ON order_items(is_comped) WHERE is_comped = true;
CREATE INDEX IF NOT EXISTS idx_discount_applications_order ON discount_applications(order_id);
CREATE INDEX IF NOT EXISTS idx_discount_applications_item ON discount_applications(order_item_id) WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_void_reasons_active ON void_reasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discount_types_active ON discount_types(is_active) WHERE is_active = true;

-- ============================================================================
-- ROLE DEFAULT PERMISSIONS
-- ============================================================================

-- Create a function to get default permissions by role
CREATE OR REPLACE FUNCTION get_default_permissions(user_role VARCHAR)
RETURNS JSONB AS $$
BEGIN
    CASE user_role
        WHEN 'admin' THEN
            RETURN '{
                "void_item": true,
                "discount_item": true,
                "comp_item": true,
                "order_discount": true,
                "manager_override": true,
                "view_reports": true,
                "manage_users": true
            }'::jsonb;
        WHEN 'manager' THEN
            RETURN '{
                "void_item": true,
                "discount_item": true,
                "comp_item": true,
                "order_discount": true,
                "manager_override": true,
                "view_reports": true
            }'::jsonb;
        WHEN 'cashier' THEN
            RETURN '{
                "void_item": true,
                "discount_item": true,
                "order_discount": true
            }'::jsonb;
        WHEN 'server' THEN
            RETURN '{
                "void_item": true,
                "discount_item": true,
                "order_discount": true
            }'::jsonb;
        WHEN 'kitchen' THEN
            RETURN '{}'::jsonb;
        ELSE
            RETURN '{}'::jsonb;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
