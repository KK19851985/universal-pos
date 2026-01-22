-- Sync & Offline Capabilities Module Migration

-- Sync Sessions
CREATE TABLE sync_sessions (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    location_id INTEGER REFERENCES locations(id),
    user_id INTEGER REFERENCES users(id),
    session_type VARCHAR(20) DEFAULT 'sync', -- sync, backup, restore
    status VARCHAR(20) DEFAULT 'active', -- active, completed, failed
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    total_records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync Queue (for offline operations)
CREATE TABLE sync_queue (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- create, update, delete
    entity_type VARCHAR(50) NOT NULL, -- orders, customers, products, etc.
    entity_id VARCHAR(255), -- could be integer or UUID
    data JSONB NOT NULL,
    priority INTEGER DEFAULT 1, -- 1=low, 5=high
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    expires_at TIMESTAMP -- for time-sensitive operations
);

-- Device Registry
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50) DEFAULT 'pos', -- pos, mobile, tablet, kiosk
    location_id INTEGER REFERENCES locations(id),
    user_id INTEGER REFERENCES users(id), -- primary user
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMP,
    app_version VARCHAR(50),
    os_version VARCHAR(100),
    capabilities JSONB, -- supported features
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Offline Data Cache
CREATE TABLE offline_cache (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    cache_key VARCHAR(255) NOT NULL,
    cache_type VARCHAR(50) NOT NULL, -- products, customers, settings, etc.
    data JSONB NOT NULL,
    version INTEGER DEFAULT 1,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(device_id, cache_key)
);

-- Conflict Resolution Log
CREATE TABLE sync_conflicts (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    local_data JSONB,
    server_data JSONB,
    conflict_type VARCHAR(20) DEFAULT 'update_conflict', -- update_conflict, delete_conflict
    resolution VARCHAR(20), -- local_wins, server_wins, manual_merge, pending
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Versioning (for optimistic locking)
CREATE TABLE data_versions (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by INTEGER REFERENCES users(id),
    UNIQUE(entity_type, entity_id)
);

-- Network Status Log
CREATE TABLE network_status_log (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL, -- online, offline, intermittent
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latency_ms INTEGER,
    bandwidth_mbps DECIMAL(5,2),
    error_details TEXT
);

-- Offline Transactions (for financial reconciliation)
CREATE TABLE offline_transactions (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- sale, refund, payment
    amount DECIMAL(10,2) NOT NULL,
    data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_sync_sessions_device ON sync_sessions(device_id);
CREATE INDEX idx_sync_sessions_status ON sync_sessions(status);
CREATE INDEX idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_priority ON sync_queue(priority);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_location ON devices(location_id);
CREATE INDEX idx_offline_cache_device ON offline_cache(device_id);
CREATE INDEX idx_offline_cache_expires ON offline_cache(expires_at);
CREATE INDEX idx_sync_conflicts_device ON sync_conflicts(device_id);
CREATE INDEX idx_sync_conflicts_resolution ON sync_conflicts(resolution);
CREATE INDEX idx_data_versions_entity ON data_versions(entity_type, entity_id);
CREATE INDEX idx_network_status_device ON network_status_log(device_id);
CREATE INDEX idx_offline_transactions_device ON offline_transactions(device_id);
CREATE INDEX idx_offline_transactions_status ON offline_transactions(status);

-- Constraints
ALTER TABLE sync_queue ADD CONSTRAINT chk_priority CHECK (priority >= 1 AND priority <= 5);
ALTER TABLE sync_queue ADD CONSTRAINT chk_retry_count CHECK (retry_count >= 0);
ALTER TABLE data_versions ADD CONSTRAINT chk_version CHECK (version > 0);