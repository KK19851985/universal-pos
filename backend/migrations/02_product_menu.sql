-- Product/Menu Module Migration

-- Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id), -- for subcategories
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products/Items
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    category_id INTEGER REFERENCES categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    base_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    tax_rate DECIMAL(5,4) DEFAULT 0.08, -- 8% default
    is_active BOOLEAN DEFAULT true,
    track_inventory BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Product Modifiers/Options (e.g., size, toppings)
CREATE TABLE product_modifiers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    name VARCHAR(255) NOT NULL, -- e.g., "Size", "Toppings"
    type VARCHAR(20) DEFAULT 'single', -- single, multiple
    required BOOLEAN DEFAULT false,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE modifier_options (
    id SERIAL PRIMARY KEY,
    modifier_id INTEGER REFERENCES product_modifiers(id),
    name VARCHAR(255) NOT NULL, -- e.g., "Small", "Large", "Extra Cheese"
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price Levels (different pricing for different customer types)
CREATE TABLE price_levels (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL, -- e.g., "Regular", "VIP", "Wholesale"
    multiplier DECIMAL(5,4) DEFAULT 1.0, -- percentage of base price
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_price_levels (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    price_level_id INTEGER REFERENCES price_levels(id),
    custom_price DECIMAL(10,2), -- NULL to use multiplier
    UNIQUE(product_id, price_level_id)
);

-- Combo/Bundle products
CREATE TABLE product_bundles (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bundle_items (
    id SERIAL PRIMARY KEY,
    bundle_id INTEGER REFERENCES product_bundles(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    fixed_price DECIMAL(10,2), -- NULL for standard pricing
    sort_order INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_modifier_options_modifier ON modifier_options(modifier_id);