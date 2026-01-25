-- Complete SQLite Schema for Universal POS
-- Converted from PostgreSQL migrations

-- ==================== CORE FOUNDATION ====================

-- Organizations (multi-tenant support)
CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    tax_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Locations (branches/stores)
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    timezone TEXT DEFAULT 'UTC',
    currency TEXT DEFAULT 'USD',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(organization_id, code)
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    is_active INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- User Permissions
CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    location_id INTEGER REFERENCES locations(id),
    permission TEXT NOT NULL,
    granted_by INTEGER REFERENCES users(id),
    granted_at TEXT DEFAULT (datetime('now'))
);

-- Global Settings
CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    data_type TEXT DEFAULT 'string',
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    user_id INTEGER REFERENCES users(id),
    location_id INTEGER REFERENCES locations(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    old_values TEXT,
    new_values TEXT,
    metadata TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- ==================== PRODUCTS/MENU ====================

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Products/Items
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    category_id INTEGER REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    barcode TEXT,
    base_price REAL NOT NULL,
    base_price_cents INTEGER DEFAULT 0,
    cost_price REAL,
    cost_price_cents INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 0.08,
    is_active INTEGER DEFAULT 1,
    track_inventory INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Product Modifiers
CREATE TABLE IF NOT EXISTS product_modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'single',
    required INTEGER DEFAULT 0,
    min_selections INTEGER DEFAULT 0,
    max_selections INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Modifier Options
CREATE TABLE IF NOT EXISTS modifier_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modifier_id INTEGER REFERENCES product_modifiers(id),
    name TEXT NOT NULL,
    price_adjustment REAL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Price Levels
CREATE TABLE IF NOT EXISTS price_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    multiplier REAL DEFAULT 1.0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Product Bundles
CREATE TABLE IF NOT EXISTS product_bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Bundle Items
CREATE TABLE IF NOT EXISTS bundle_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER REFERENCES product_bundles(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    fixed_price REAL,
    sort_order INTEGER DEFAULT 0
);

-- ==================== ORDERS/SALES ====================

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    location_id INTEGER REFERENCES locations(id),
    user_id INTEGER REFERENCES users(id),
    customer_id INTEGER,
    table_id INTEGER,
    reservation_id INTEGER,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'open',
    order_type TEXT DEFAULT 'dine_in',
    guest_count INTEGER DEFAULT 1,
    subtotal REAL DEFAULT 0,
    subtotal_cents INTEGER DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    tax_amount_cents INTEGER DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_amount_cents INTEGER DEFAULT 0,
    service_charge REAL DEFAULT 0,
    service_charge_cents INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    total_amount_cents INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    bundle_id INTEGER REFERENCES product_bundles(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    unit_price_cents INTEGER DEFAULT 0,
    total_price REAL NOT NULL,
    total_price_cents INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    kitchen_station_id INTEGER,
    assigned_staff INTEGER,
    started_at TEXT,
    completed_at TEXT,
    served_at TEXT,
    special_instructions TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Order Item Modifiers
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER REFERENCES order_items(id),
    modifier_option_id INTEGER REFERENCES modifier_options(id),
    quantity INTEGER DEFAULT 1,
    price_adjustment REAL DEFAULT 0
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id),
    amount REAL NOT NULL,
    amount_cents INTEGER DEFAULT 0,
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    status TEXT DEFAULT 'completed',
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    processed_at TEXT DEFAULT (datetime('now'))
);

-- Discounts
CREATE TABLE IF NOT EXISTS discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    code TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    valid_from TEXT,
    valid_until TEXT,
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Order Discounts
CREATE TABLE IF NOT EXISTS order_discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    discount_id INTEGER REFERENCES discounts(id),
    amount REAL NOT NULL,
    applied_by INTEGER REFERENCES users(id),
    applied_at TEXT DEFAULT (datetime('now'))
);

-- Refunds
CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER REFERENCES payments(id),
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id),
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    processed_at TEXT DEFAULT (datetime('now'))
);

-- Voids
CREATE TABLE IF NOT EXISTS voids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    voided_at TEXT DEFAULT (datetime('now'))
);

-- ==================== TABLE MANAGEMENT ====================

-- Floor Plans
CREATE TABLE IF NOT EXISTS floor_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Tables
CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_plan_id INTEGER REFERENCES floor_plans(id),
    table_number TEXT NOT NULL,
    name TEXT,
    capacity INTEGER NOT NULL,
    shape TEXT DEFAULT 'round',
    position_x INTEGER,
    position_y INTEGER,
    width INTEGER,
    height INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(floor_plan_id, table_number)
);

-- Table Statuses
CREATE TABLE IF NOT EXISTS table_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER REFERENCES tables(id),
    status TEXT NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    user_id INTEGER REFERENCES users(id),
    notes TEXT,
    estimated_duration INTEGER,
    ended_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Table Groups
CREATE TABLE IF NOT EXISTS table_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    name TEXT,
    status TEXT DEFAULT 'active',
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== RESERVATIONS ====================

-- Reservation Types
CREATE TABLE IF NOT EXISTS reservation_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    default_duration INTEGER,
    requires_deposit INTEGER DEFAULT 0,
    deposit_amount REAL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    reservation_type_id INTEGER REFERENCES reservation_types(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    requested_date TEXT NOT NULL,
    requested_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    special_requests TEXT,
    status TEXT DEFAULT 'pending',
    table_id INTEGER REFERENCES tables(id),
    assigned_staff INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    confirmed_at TEXT,
    arrived_at TEXT,
    completed_at TEXT
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    party_size INTEGER NOT NULL,
    estimated_wait_time INTEGER,
    status TEXT DEFAULT 'waiting',
    notified_at TEXT,
    seated_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ==================== INVENTORY ====================

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT,
    tax_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES inventory_categories(id),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    category_id INTEGER REFERENCES inventory_categories(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    barcode TEXT,
    unit_of_measure TEXT DEFAULT 'each',
    unit_cost REAL,
    selling_price REAL,
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER,
    is_active INTEGER DEFAULT 1,
    track_inventory INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Locations
CREATE TABLE IF NOT EXISTS inventory_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'stockroom',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Inventory Transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER REFERENCES inventory_items(id),
    location_id INTEGER REFERENCES inventory_locations(id),
    transaction_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit_cost REAL,
    reference_id INTEGER,
    reference_type TEXT,
    notes TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== KITCHEN ====================

-- Kitchen Stations
CREATE TABLE IF NOT EXISTS kitchen_stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER REFERENCES locations(id),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    printer_ip TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Menu Items (linking products to kitchen stations)
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id),
    kitchen_station_id INTEGER REFERENCES kitchen_stations(id),
    prep_time INTEGER,
    cook_time INTEGER,
    plating_instructions TEXT,
    special_notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Kitchen Tickets
CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id),
    ticket_number TEXT UNIQUE,
    station_id INTEGER REFERENCES kitchen_stations(id),
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'normal',
    estimated_completion_time TEXT,
    printed_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Kitchen Ticket Items
CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER REFERENCES kitchen_tickets(id),
    order_item_id INTEGER REFERENCES order_items(id),
    display_order INTEGER,
    special_instructions TEXT,
    status TEXT DEFAULT 'pending',
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== CRM/CUSTOMERS ====================

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth TEXT,
    gender TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    loyalty_number TEXT UNIQUE,
    total_visits INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    average_spend REAL DEFAULT 0,
    last_visit_date TEXT,
    preferred_payment_method TEXT,
    marketing_opt_in INTEGER DEFAULT 1,
    email_verified INTEGER DEFAULT 0,
    phone_verified INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Customer Groups
CREATE TABLE IF NOT EXISTS customer_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    criteria TEXT,
    discount_percentage REAL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== LOYALTY ====================

-- Loyalty Programs
CREATE TABLE IF NOT EXISTS loyalty_programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    points_per_dollar REAL DEFAULT 1.0,
    redemption_rate REAL DEFAULT 0.01,
    minimum_redemption INTEGER DEFAULT 100,
    expiration_months INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Loyalty Accounts
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES customers(id),
    program_id INTEGER REFERENCES loyalty_programs(id),
    current_points INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    total_points_redeemed INTEGER DEFAULT 0,
    member_since TEXT DEFAULT (datetime('now')),
    last_activity TEXT DEFAULT (datetime('now')),
    is_active INTEGER DEFAULT 1,
    UNIQUE(customer_id, program_id)
);

-- Loyalty Transactions
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES loyalty_accounts(id),
    transaction_type TEXT NOT NULL,
    points INTEGER NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Loyalty Tiers
CREATE TABLE IF NOT EXISTS loyalty_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER REFERENCES loyalty_programs(id),
    name TEXT NOT NULL,
    description TEXT,
    minimum_points INTEGER NOT NULL,
    multiplier REAL DEFAULT 1.0,
    benefits TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ==================== IDEMPOTENCY ====================

-- Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotency_key TEXT NOT NULL,
    action TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    locked_at TEXT,
    locked_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(idempotency_key, action)
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_tables_floor ON tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_table_statuses_table ON table_statuses(table_id);
CREATE INDEX IF NOT EXISTS idx_reservations_location ON reservations(location_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(requested_date);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order ON kitchen_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON kitchen_tickets(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty ON customers(loyalty_number);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON loyalty_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account ON loyalty_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

-- ==================== DEFAULT DATA ====================

-- Insert default organization and location
INSERT OR IGNORE INTO organizations (id, name, code) VALUES (1, 'Default Organization', 'DEFAULT');
INSERT OR IGNORE INTO locations (id, organization_id, name, code) VALUES (1, 1, 'Main Location', 'MAIN');

-- Insert default floor plan
INSERT OR IGNORE INTO floor_plans (id, location_id, name) VALUES (1, 1, 'Main Floor');

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (id, organization_id, username, password_hash, full_name, role, is_active) 
VALUES (1, 1, 'admin', '$2b$10$rFzSEjF8QHD.9JYT.9I3Eu6T.fxjWB3QkTd1r6C8jY3pYxJKhVD.W', 'Administrator', 'admin', 1);

-- Insert default loyalty program
INSERT OR IGNORE INTO loyalty_programs (id, organization_id, name, points_per_dollar, redemption_rate, minimum_redemption, is_active)
VALUES (1, 1, 'Default Loyalty Program', 1.0, 0.01, 100, 1);
