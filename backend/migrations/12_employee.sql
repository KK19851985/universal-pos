-- Employee Management & Scheduling Module Migration

-- Employee Roles
CREATE TABLE employee_roles (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    permissions JSONB, -- role permissions
    wage_rate DECIMAL(8,2),
    overtime_rate DECIMAL(8,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees (extends users table)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    employee_number VARCHAR(50) UNIQUE,
    role_id INTEGER REFERENCES employee_roles(id),
    manager_id INTEGER REFERENCES employees(id),
    hire_date DATE NOT NULL,
    termination_date DATE,
    wage_type VARCHAR(20) DEFAULT 'hourly', -- hourly, salary
    base_wage DECIMAL(8,2),
    overtime_rate DECIMAL(8,2),
    work_schedule JSONB, -- default schedule
    skills JSONB, -- employee skills/certifications
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time Clock Entries
CREATE TABLE time_entries (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    location_id INTEGER REFERENCES locations(id),
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    total_hours DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN clock_out IS NOT NULL THEN
                EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600.0
                - COALESCE(EXTRACT(EPOCH FROM (break_end - break_start)) / 3600.0, 0)
            ELSE NULL
        END
    ) STORED,
    regular_hours DECIMAL(5,2),
    overtime_hours DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'active', -- active, completed, edited
    notes TEXT,
    approved_by INTEGER REFERENCES employees(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work Schedules
CREATE TABLE work_schedules (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    location_id INTEGER REFERENCES locations(id),
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER DEFAULT 30, -- minutes
    role_id INTEGER REFERENCES employee_roles(id),
    is_published BOOLEAN DEFAULT false,
    notes TEXT,
    created_by INTEGER REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, schedule_date)
);

-- Schedule Templates
CREATE TABLE schedule_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB, -- weekly schedule template
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES employees(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time Off Requests
CREATE TABLE time_off_requests (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    request_type VARCHAR(50) NOT NULL, -- vacation, sick, personal, etc.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours_requested DECIMAL(5,2),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, denied, cancelled
    approved_by INTEGER REFERENCES employees(id),
    approved_at TIMESTAMP,
    denied_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Performance
CREATE TABLE employee_performance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    review_date DATE NOT NULL,
    reviewer_id INTEGER REFERENCES employees(id),
    rating DECIMAL(3,1) CHECK (rating >= 1.0 AND rating <= 5.0),
    categories JSONB, -- performance categories and ratings
    comments TEXT,
    goals JSONB, -- performance goals
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training Records
CREATE TABLE training_records (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id),
    training_type VARCHAR(100) NOT NULL,
    training_date DATE NOT NULL,
    trainer VARCHAR(255),
    duration_hours DECIMAL(4,1),
    certification_earned VARCHAR(255),
    certification_expiry DATE,
    score DECIMAL(5,2), -- if applicable
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll Periods
CREATE TABLE payroll_periods (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, processing, completed
    processed_by INTEGER REFERENCES employees(id),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll Entries
CREATE TABLE payroll_entries (
    id SERIAL PRIMARY KEY,
    payroll_period_id INTEGER REFERENCES payroll_periods(id),
    employee_id INTEGER REFERENCES employees(id),
    regular_hours DECIMAL(5,2) DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    gross_pay DECIMAL(10,2),
    deductions JSONB,
    net_pay DECIMAL(10,2),
    taxes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_employee_roles_org ON employee_roles(organization_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_employees_role ON employees(role_id);
CREATE INDEX idx_employees_manager ON employees(manager_id);
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_date ON time_entries(clock_in);
CREATE INDEX idx_work_schedules_employee ON work_schedules(employee_id);
CREATE INDEX idx_work_schedules_date ON work_schedules(schedule_date);
CREATE INDEX idx_time_off_requests_employee ON time_off_requests(employee_id);
CREATE INDEX idx_time_off_requests_status ON time_off_requests(status);
CREATE INDEX idx_employee_performance_employee ON employee_performance(employee_id);
CREATE INDEX idx_training_records_employee ON training_records(employee_id);
CREATE INDEX idx_payroll_periods_org ON payroll_periods(organization_id);
CREATE INDEX idx_payroll_entries_period ON payroll_entries(payroll_period_id);
CREATE INDEX idx_payroll_entries_employee ON payroll_entries(employee_id);

-- Constraints
ALTER TABLE time_entries ADD CONSTRAINT chk_clock_times CHECK (clock_out IS NULL OR clock_out > clock_in);
ALTER TABLE work_schedules ADD CONSTRAINT chk_schedule_times CHECK (end_time > start_time);
ALTER TABLE time_off_requests ADD CONSTRAINT chk_request_dates CHECK (end_date >= start_date);