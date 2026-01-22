-- Table & Floor Management Module Migration

-- Floor Plans/Layouts
CREATE TABLE floor_plans (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables
CREATE TABLE tables (
    id SERIAL PRIMARY KEY,
    floor_plan_id INTEGER REFERENCES floor_plans(id),
    table_number VARCHAR(50) NOT NULL,
    name VARCHAR(255), -- optional friendly name
    capacity INTEGER NOT NULL,
    shape VARCHAR(20) DEFAULT 'round', -- round, square, rectangle
    position_x INTEGER, -- for visual layout
    position_y INTEGER,
    width INTEGER,
    height INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(floor_plan_id, table_number)
);

-- Table States/Statuses
CREATE TABLE table_statuses (
    id SERIAL PRIMARY KEY,
    table_id INTEGER REFERENCES tables(id),
    status VARCHAR(20) NOT NULL, -- available, seated, reserved, billed, cleaning, blocked
    order_id INTEGER REFERENCES orders(id), -- current order if seated
    user_id INTEGER REFERENCES users(id), -- staff who set status
    notes TEXT,
    estimated_duration INTEGER, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table Merges/Splits
CREATE TABLE table_groups (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    name VARCHAR(255), -- optional group name
    status VARCHAR(20) DEFAULT 'active', -- active, merged, split
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE table_group_members (
    id SERIAL PRIMARY KEY,
    table_group_id INTEGER REFERENCES table_groups(id),
    table_id INTEGER REFERENCES tables(id),
    role VARCHAR(20) DEFAULT 'member', -- primary, member
    UNIQUE(table_group_id, table_id)
);

-- Indexes
CREATE INDEX idx_tables_floor ON tables(floor_plan_id);
CREATE INDEX idx_table_statuses_table ON table_statuses(table_id);
CREATE INDEX idx_table_statuses_status ON table_statuses(status);
CREATE INDEX idx_table_groups_location ON table_groups(location_id);