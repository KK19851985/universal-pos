-- Reservations Module Migration

-- Reservation Types
CREATE TABLE reservation_types (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_duration INTEGER, -- minutes
    requires_deposit BOOLEAN DEFAULT false,
    deposit_amount DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reservations
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    reservation_type_id INTEGER REFERENCES reservation_types(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    party_size INTEGER NOT NULL,
    requested_date DATE NOT NULL,
    requested_time TIME NOT NULL,
    duration INTEGER NOT NULL, -- minutes
    special_requests TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, arrived, no_show, cancelled, completed
    table_id INTEGER REFERENCES tables(id),
    assigned_staff INTEGER REFERENCES users(id),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    arrived_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Reservation Notes/History
CREATE TABLE reservation_notes (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER REFERENCES reservations(id),
    user_id INTEGER REFERENCES users(id),
    note_type VARCHAR(20) DEFAULT 'note', -- note, status_change, customer_contact
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Waitlist
CREATE TABLE waitlist (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    party_size INTEGER NOT NULL,
    estimated_wait_time INTEGER, -- minutes
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, notified, seated, cancelled
    notified_at TIMESTAMP,
    seated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_reservations_location ON reservations(location_id);
CREATE INDEX idx_reservations_date ON reservations(requested_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_table ON reservations(table_id);
CREATE INDEX idx_reservation_notes_reservation ON reservation_notes(reservation_id);
CREATE INDEX idx_waitlist_location ON waitlist(location_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);

-- Constraints
ALTER TABLE reservations ADD CONSTRAINT chk_party_size CHECK (party_size > 0);
ALTER TABLE reservations ADD CONSTRAINT chk_duration CHECK (duration > 0);
ALTER TABLE waitlist ADD CONSTRAINT chk_waitlist_party_size CHECK (party_size > 0);