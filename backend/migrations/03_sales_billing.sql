-- Sales & Billing Module Migration

-- Orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    location_id INTEGER REFERENCES locations(id),
    user_id INTEGER REFERENCES users(id), -- cashier/staff who created
    customer_id INTEGER, -- from CRM module (nullable)
    table_id INTEGER, -- from table management (nullable)
    reservation_id INTEGER, -- from reservations (nullable)
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, confirmed, paid, closed, voided
    order_type VARCHAR(20) DEFAULT 'dine_in', -- dine_in, takeout, delivery
    guest_count INTEGER DEFAULT 1,
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    service_charge DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

-- Order Items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    bundle_id INTEGER REFERENCES product_bundles(id), -- NULL if not a bundle
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT, -- special instructions
    status VARCHAR(20) DEFAULT 'pending', -- pending, preparing, ready, served, voided
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Item Modifiers (selected options)
CREATE TABLE order_item_modifiers (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER REFERENCES order_items(id),
    modifier_option_id INTEGER REFERENCES modifier_options(id),
    quantity INTEGER DEFAULT 1,
    price_adjustment DECIMAL(10,2) DEFAULT 0
);

-- Payments
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id), -- who processed payment
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL, -- cash, card, qr, ewallet
    reference_number VARCHAR(100), -- card auth code, transaction ID
    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed, refunded
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discounts
CREATE TABLE discounts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL, -- percentage, fixed_amount
    value DECIMAL(10,2) NOT NULL,
    code VARCHAR(50) UNIQUE, -- optional coupon code
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    usage_limit INTEGER, -- NULL for unlimited
    used_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Discounts (applied to orders)
CREATE TABLE order_discounts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    discount_id INTEGER REFERENCES discounts(id),
    amount DECIMAL(10,2) NOT NULL,
    applied_by INTEGER REFERENCES users(id),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refunds
CREATE TABLE refunds (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id), -- who processed refund
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voids (order cancellations)
CREATE TABLE voids (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id), -- who voided
    reason TEXT NOT NULL,
    voided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Split Bills
CREATE TABLE order_splits (
    id SERIAL PRIMARY KEY,
    original_order_id INTEGER REFERENCES orders(id),
    split_order_id INTEGER REFERENCES orders(id),
    split_type VARCHAR(20) DEFAULT 'equal', -- equal, custom, item_based
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_orders_location ON orders(location_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);