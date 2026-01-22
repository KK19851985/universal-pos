-- Kitchen Management Module Migration

-- Kitchen Stations
CREATE TABLE kitchen_stations (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'general', -- grill, fry, prep, expo, bar, etc.
    printer_ip VARCHAR(45), -- IP address for kitchen printer
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Menu Items (linking products to kitchen)
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    kitchen_station_id INTEGER REFERENCES kitchen_stations(id),
    prep_time INTEGER, -- minutes
    cook_time INTEGER, -- minutes
    plating_instructions TEXT,
    special_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add kitchen-specific columns to order_items (created in 03_sales_billing.sql)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kitchen_station_id INTEGER REFERENCES kitchen_stations(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS assigned_staff INTEGER REFERENCES users(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS served_at TIMESTAMP;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Kitchen Tickets
CREATE TABLE kitchen_tickets (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    ticket_number VARCHAR(50) UNIQUE,
    station_id INTEGER REFERENCES kitchen_stations(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, printing, printed, completed
    priority VARCHAR(10) DEFAULT 'normal', -- low, normal, high, rush
    estimated_completion_time TIMESTAMP,
    printed_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kitchen Ticket Items
CREATE TABLE kitchen_ticket_items (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES kitchen_tickets(id),
    order_item_id INTEGER REFERENCES order_items(id),
    display_order INTEGER,
    special_instructions TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, preparing, ready
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recipe Ingredients (for inventory tracking)
CREATE TABLE recipe_ingredients (
    id SERIAL PRIMARY KEY,
    menu_item_id INTEGER REFERENCES menu_items(id),
    inventory_item_id INTEGER REFERENCES inventory_items(id),
    quantity_required DECIMAL(10,4) NOT NULL,
    unit_of_measure VARCHAR(20),
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kitchen Performance Metrics
CREATE TABLE kitchen_metrics (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    station_id INTEGER REFERENCES kitchen_stations(id),
    total_orders INTEGER DEFAULT 0,
    avg_prep_time INTEGER, -- minutes
    avg_cook_time INTEGER, -- minutes
    orders_completed_on_time INTEGER DEFAULT 0,
    orders_delayed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date, station_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kitchen_stations_location ON kitchen_stations(location_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_product ON menu_items(product_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_station ON menu_items(kitchen_station_id);
CREATE INDEX IF NOT EXISTS idx_order_items_kitchen_station ON order_items(kitchen_station_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_order ON kitchen_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_station ON kitchen_tickets(station_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON kitchen_tickets(status);
CREATE INDEX IF NOT EXISTS idx_kitchen_ticket_items_ticket ON kitchen_ticket_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_menu ON recipe_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_metrics_location ON kitchen_metrics(location_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_metrics_date ON kitchen_metrics(date);

-- Constraints (only add if not exists - PostgreSQL doesn't have IF NOT EXISTS for constraints)
DO $$ BEGIN
    ALTER TABLE kitchen_ticket_items ADD CONSTRAINT chk_display_order CHECK (display_order >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;