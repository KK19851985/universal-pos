-- Customer Relationship Management Module Migration

-- Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10),
    address TEXT,
    city VARCHAR(255),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    loyalty_number VARCHAR(50) UNIQUE,
    total_visits INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    average_spend DECIMAL(10,2) DEFAULT 0,
    last_visit_date TIMESTAMP,
    preferred_payment_method VARCHAR(50),
    marketing_opt_in BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Groups/Segments
CREATE TABLE customer_groups (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB, -- flexible criteria for automatic assignment
    discount_percentage DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_group_members (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    group_id INTEGER REFERENCES customer_groups(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    UNIQUE(customer_id, group_id)
);

-- Customer Notes/History
CREATE TABLE customer_notes (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    user_id INTEGER REFERENCES users(id),
    note_type VARCHAR(20) DEFAULT 'general', -- general, complaint, compliment, allergy, preference
    content TEXT NOT NULL,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Preferences
CREATE TABLE customer_preferences (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    preference_type VARCHAR(50) NOT NULL, -- dietary, seating, payment, communication
    preference_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, preference_type)
);

-- Loyalty Program
CREATE TABLE loyalty_programs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    points_per_dollar DECIMAL(10,2) DEFAULT 1.0,
    redemption_rate DECIMAL(10,2) DEFAULT 0.01, -- dollars per point
    minimum_redemption INTEGER DEFAULT 100,
    expiration_months INTEGER, -- NULL for no expiration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_accounts (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    program_id INTEGER REFERENCES loyalty_programs(id),
    current_points INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    total_points_redeemed INTEGER DEFAULT 0,
    member_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(customer_id, program_id)
);

CREATE TABLE loyalty_transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES loyalty_accounts(id),
    transaction_type VARCHAR(20) NOT NULL, -- earn, redeem, adjustment, expiration
    points INTEGER NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Feedback/Surveys
CREATE TABLE customer_feedback (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    order_id INTEGER REFERENCES orders(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(20) DEFAULT 'general', -- service, food, ambiance, value
    comments TEXT,
    response TEXT, -- staff response
    responded_by INTEGER REFERENCES users(id),
    responded_at TIMESTAMP,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_customers_organization ON customers(organization_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_loyalty ON customers(loyalty_number);
CREATE INDEX idx_customer_groups_org ON customer_groups(organization_id);
CREATE INDEX idx_customer_group_members_customer ON customer_group_members(customer_id);
CREATE INDEX idx_customer_group_members_group ON customer_group_members(group_id);
CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_id);
CREATE INDEX idx_customer_preferences_customer ON customer_preferences(customer_id);
CREATE INDEX idx_loyalty_programs_org ON loyalty_programs(organization_id);
CREATE INDEX idx_loyalty_accounts_customer ON loyalty_accounts(customer_id);
CREATE INDEX idx_loyalty_accounts_program ON loyalty_accounts(program_id);
CREATE INDEX idx_loyalty_transactions_account ON loyalty_transactions(account_id);
CREATE INDEX idx_customer_feedback_customer ON customer_feedback(customer_id);
CREATE INDEX idx_customer_feedback_order ON customer_feedback(order_id);

-- Constraints (rating check already defined inline on customer_feedback.rating)
ALTER TABLE loyalty_accounts ADD CONSTRAINT chk_current_points CHECK (current_points >= 0);