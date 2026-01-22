-- Inventory Management Module Migration

-- Suppliers/Vendors
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    payment_terms VARCHAR(100),
    tax_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Categories
CREATE TABLE inventory_categories (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES inventory_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    category_id INTEGER REFERENCES inventory_categories(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    unit_of_measure VARCHAR(20) DEFAULT 'each', -- each, lb, kg, oz, gallon, etc.
    unit_cost DECIMAL(10,4),
    selling_price DECIMAL(10,2),
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER,
    is_active BOOLEAN DEFAULT true,
    track_inventory BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Locations/Stockrooms
CREATE TABLE inventory_locations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) DEFAULT 'stockroom', -- stockroom, display, storage
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Quantities
CREATE TABLE stock_quantities (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id),
    location_id INTEGER REFERENCES inventory_locations(id),
    quantity_on_hand DECIMAL(10,4) DEFAULT 0,
    quantity_reserved DECIMAL(10,4) DEFAULT 0,
    quantity_available DECIMAL(10,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    last_counted_at TIMESTAMP,
    last_counted_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, location_id)
);

-- Inventory Transactions
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id),
    location_id INTEGER REFERENCES inventory_locations(id),
    transaction_type VARCHAR(20) NOT NULL, -- purchase, sale, adjustment, transfer, waste
    quantity DECIMAL(10,4) NOT NULL,
    unit_cost DECIMAL(10,4),
    reference_id INTEGER, -- order_id, purchase_order_id, etc.
    reference_type VARCHAR(50), -- orders, purchase_orders, adjustments
    notes TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    status VARCHAR(20) DEFAULT 'draft', -- draft, ordered, received, cancelled
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    total_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id),
    item_id INTEGER REFERENCES inventory_items(id),
    quantity_ordered DECIMAL(10,4) NOT NULL,
    quantity_received DECIMAL(10,4) DEFAULT 0,
    unit_cost DECIMAL(10,4) NOT NULL,
    line_total DECIMAL(10,2) GENERATED ALWAYS AS (quantity_ordered * unit_cost) STORED,
    received_at TIMESTAMP,
    received_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_supplier ON inventory_items(supplier_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_stock_quantities_item ON stock_quantities(item_id);
CREATE INDEX idx_stock_quantities_location ON stock_quantities(location_id);
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

-- Constraints
ALTER TABLE inventory_items ADD CONSTRAINT chk_reorder_point CHECK (reorder_point >= 0);
ALTER TABLE stock_quantities ADD CONSTRAINT chk_quantity_on_hand CHECK (quantity_on_hand >= 0);
ALTER TABLE inventory_transactions ADD CONSTRAINT chk_transaction_quantity CHECK (quantity != 0);