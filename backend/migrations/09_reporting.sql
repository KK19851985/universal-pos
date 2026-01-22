-- Reporting & Analytics Module Migration

-- Report Templates
CREATE TABLE report_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL, -- sales, inventory, customer, performance, financial
    category VARCHAR(50), -- daily, weekly, monthly, custom
    query_definition JSONB, -- stored query definition
    parameters JSONB, -- parameter definitions
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Reports
CREATE TABLE scheduled_reports (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES report_templates(id),
    name VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL, -- daily, weekly, monthly
    schedule_config JSONB, -- cron-like config or simple rules
    recipients JSONB, -- email addresses or user IDs
    format VARCHAR(10) DEFAULT 'pdf', -- pdf, excel, csv
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report Executions/History
CREATE TABLE report_executions (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES report_templates(id),
    scheduled_report_id INTEGER REFERENCES scheduled_reports(id),
    executed_by INTEGER REFERENCES users(id),
    parameters_used JSONB,
    execution_time INTEGER, -- seconds
    status VARCHAR(20) DEFAULT 'completed', -- running, completed, failed
    file_path VARCHAR(500), -- path to generated report file
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Summary (daily aggregations)
CREATE TABLE sales_summary_daily (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    total_sales DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_tax DECIMAL(10,2) DEFAULT 0,
    total_discounts DECIMAL(10,2) DEFAULT 0,
    total_tips DECIMAL(10,2) DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    payment_method_breakdown JSONB,
    hourly_sales JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date)
);

-- Inventory Summary
CREATE TABLE inventory_summary_daily (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    total_items INTEGER DEFAULT 0,
    low_stock_items INTEGER DEFAULT 0,
    out_of_stock_items INTEGER DEFAULT 0,
    total_value DECIMAL(10,2) DEFAULT 0,
    items_received INTEGER DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    waste_value DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date)
);

-- Customer Analytics
CREATE TABLE customer_analytics_daily (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    average_customer_value DECIMAL(10,2) DEFAULT 0,
    customer_satisfaction_avg DECIMAL(3,2), -- 1.0 to 5.0
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date)
);

-- Performance Metrics
CREATE TABLE performance_metrics_daily (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    avg_order_time INTEGER, -- minutes
    avg_prep_time INTEGER, -- minutes
    table_turnover_rate DECIMAL(5,2),
    staff_productivity DECIMAL(5,2),
    customer_wait_time_avg INTEGER, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date)
);

-- Financial Summary
CREATE TABLE financial_summary_daily (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    date DATE NOT NULL,
    gross_sales DECIMAL(10,2) DEFAULT 0,
    net_sales DECIMAL(10,2) DEFAULT 0,
    cost_of_goods_sold DECIMAL(10,2) DEFAULT 0,
    gross_profit DECIMAL(10,2) DEFAULT 0,
    operating_expenses DECIMAL(10,2) DEFAULT 0,
    net_profit DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(location_id, date)
);

-- Custom Dashboards
CREATE TABLE dashboards (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB, -- dashboard layout configuration
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dashboard_widgets (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER REFERENCES dashboards(id),
    widget_type VARCHAR(50) NOT NULL, -- chart, table, metric, gauge
    title VARCHAR(255) NOT NULL,
    data_source JSONB, -- query or data source config
    configuration JSONB, -- widget-specific config
    position_x INTEGER,
    position_y INTEGER,
    width INTEGER,
    height INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX idx_report_templates_type ON report_templates(report_type);
CREATE INDEX idx_scheduled_reports_template ON scheduled_reports(template_id);
CREATE INDEX idx_report_executions_template ON report_executions(template_id);
CREATE INDEX idx_sales_summary_location ON sales_summary_daily(location_id);
CREATE INDEX idx_sales_summary_date ON sales_summary_daily(date);
CREATE INDEX idx_inventory_summary_location ON inventory_summary_daily(location_id);
CREATE INDEX idx_customer_analytics_location ON customer_analytics_daily(location_id);
CREATE INDEX idx_performance_metrics_location ON performance_metrics_daily(location_id);
CREATE INDEX idx_financial_summary_location ON financial_summary_daily(location_id);
CREATE INDEX idx_dashboards_org ON dashboards(organization_id);
CREATE INDEX idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);