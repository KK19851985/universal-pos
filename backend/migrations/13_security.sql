-- Security & Audit Module Migration

-- Security Events (extends audit_log)
CREATE TABLE security_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- login, logout, password_change, permission_change, etc.
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    location_data JSONB, -- geolocation if available
    event_data JSONB, -- additional event-specific data
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failed Login Attempts
CREATE TABLE failed_logins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100) DEFAULT 'invalid_credentials'
);

-- Account Lockouts
CREATE TABLE account_lockouts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    lockout_reason VARCHAR(100) NOT NULL,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unlocked_at TIMESTAMP,
    unlocked_by INTEGER REFERENCES users(id)
);

-- Password History
CREATE TABLE password_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    password_hash VARCHAR(255) NOT NULL,
    set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    set_by INTEGER REFERENCES users(id), -- NULL for self-change
    expires_at TIMESTAMP
);

-- API Keys/Secrets
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Access Logs
CREATE TABLE data_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL, -- view, create, update, delete
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    old_values JSONB, -- for updates/deletes
    new_values JSONB, -- for creates/updates
    access_reason VARCHAR(255), -- business justification
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security Policies
CREATE TABLE security_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    policy_type VARCHAR(50) NOT NULL, -- password, session, access, encryption
    policy_name VARCHAR(255) NOT NULL,
    policy_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encryption Keys (for data at rest)
CREATE TABLE encryption_keys (
    id SERIAL PRIMARY KEY,
    key_id VARCHAR(255) UNIQUE NOT NULL,
    key_version INTEGER NOT NULL,
    key_data BYTEA NOT NULL, -- encrypted key material
    algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    purpose VARCHAR(50) NOT NULL, -- database, files, api
    status VARCHAR(20) DEFAULT 'active', -- active, rotated, compromised
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    rotated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance Logs (GDPR, PCI, etc.)
CREATE TABLE compliance_logs (
    id SERIAL PRIMARY KEY,
    compliance_standard VARCHAR(50) NOT NULL, -- GDPR, PCI-DSS, SOX, etc.
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    entity_type VARCHAR(50),
    entity_id VARCHAR(255),
    event_data JSONB,
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    remediation_required BOOLEAN DEFAULT false,
    remediation_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup Logs
CREATE TABLE backup_logs (
    id SERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL, -- full, incremental, differential
    status VARCHAR(20) DEFAULT 'completed', -- running, completed, failed
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    compression_ratio DECIMAL(5,2),
    encryption_used BOOLEAN DEFAULT true,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    verified_at TIMESTAMP,
    error_message TEXT,
    initiated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incident Response Logs
CREATE TABLE incident_logs (
    id SERIAL PRIMARY KEY,
    incident_type VARCHAR(50) NOT NULL, -- breach, unauthorized_access, data_loss, etc.
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'investigating', -- investigating, contained, resolved, closed
    description TEXT NOT NULL,
    affected_users INTEGER,
    affected_records INTEGER,
    reported_by INTEGER REFERENCES users(id),
    assigned_to INTEGER REFERENCES employees(id),
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_user ON security_events(user_id);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_failed_logins_username ON failed_logins(username);
CREATE INDEX idx_failed_logins_ip ON failed_logins(ip_address);
CREATE INDEX idx_account_lockouts_user ON account_lockouts(user_id);
CREATE INDEX idx_password_history_user ON password_history(user_id);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_data_access_logs_user ON data_access_logs(user_id);
CREATE INDEX idx_data_access_logs_entity ON data_access_logs(entity_type, entity_id);
CREATE INDEX idx_security_policies_org ON security_policies(organization_id);
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);
CREATE INDEX idx_compliance_logs_standard ON compliance_logs(compliance_standard);
CREATE INDEX idx_backup_logs_status ON backup_logs(status);
CREATE INDEX idx_backup_logs_started ON backup_logs(started_at);
CREATE INDEX idx_incident_logs_type ON incident_logs(incident_type);
CREATE INDEX idx_incident_logs_status ON incident_logs(status);

-- Constraints
ALTER TABLE security_events ADD CONSTRAINT chk_risk_score CHECK (risk_score >= 0 AND risk_score <= 100);
ALTER TABLE password_history ADD CONSTRAINT chk_expires_future CHECK (expires_at IS NULL OR expires_at > set_at);