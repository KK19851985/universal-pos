// Patch SQLite database with missing columns and tables
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'pos.db');
console.log('Patching database:', dbPath);

const db = new Database(dbPath);

// Add missing columns to users table
try { 
    db.exec('ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT "{}"'); 
    console.log('✓ Added permissions column to users'); 
} catch(e) { 
    if (e.message.includes('duplicate column')) {
        console.log('  permissions column already exists');
    } else {
        console.log('  permissions:', e.message);
    }
}

// Add missing columns to order_items table
const orderItemColumns = [
    ['voided_at', 'TEXT'],
    ['voided_by', 'INTEGER'],
    ['void_reason_id', 'INTEGER'],
    ['void_reason_text', 'TEXT'],
    ['is_comped', 'INTEGER DEFAULT 0'],
    ['comped_at', 'TEXT'],
    ['comped_by', 'INTEGER'],
    ['comp_reason', 'TEXT'],
    ['comp_approved_by', 'INTEGER']
];

for (const [col, type] of orderItemColumns) {
    try { 
        db.exec(`ALTER TABLE order_items ADD COLUMN ${col} ${type}`); 
        console.log(`✓ Added ${col} column to order_items`); 
    } catch(e) { 
        if (e.message.includes('duplicate column')) {
            console.log(`  ${col} already exists`);
        }
    }
}

// Create void_reasons table
try { 
    db.exec(`CREATE TABLE IF NOT EXISTS void_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        requires_manager INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✓ Created void_reasons table');
    
    db.exec(`INSERT OR IGNORE INTO void_reasons (code, description, requires_manager) VALUES
        ('customer_request', 'Customer requested removal', 0),
        ('wrong_item', 'Wrong item ordered', 0),
        ('quality_issue', 'Quality/preparation issue', 0),
        ('duplicate', 'Duplicate entry', 0),
        ('out_of_stock', 'Item out of stock', 0),
        ('allergy', 'Allergy/dietary concern', 0),
        ('pricing_error', 'Pricing error correction', 1),
        ('manager_comp', 'Manager comp/courtesy', 1),
        ('other', 'Other (specify)', 0)`);
    console.log('✓ Seeded void_reasons data');
} catch(e) { 
    console.log('  void_reasons:', e.message); 
}

// Create discount_types table
try {
    db.exec(`CREATE TABLE IF NOT EXISTS discount_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        max_value_cents INTEGER,
        requires_manager INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✓ Created discount_types table');
    
    db.exec(`INSERT OR IGNORE INTO discount_types (code, name, type, value, requires_manager) VALUES
        ('happy_hour', 'Happy Hour 10%', 'percentage', 10.00, 0),
        ('senior', 'Senior Discount 15%', 'percentage', 15.00, 0),
        ('employee', 'Employee Discount 20%', 'percentage', 20.00, 0),
        ('loyalty', 'Loyalty Member 5%', 'percentage', 5.00, 0),
        ('comp_5', 'Comp $5', 'fixed_amount', 5.00, 0),
        ('comp_10', 'Comp $10', 'fixed_amount', 10.00, 1),
        ('manager_50', 'Manager 50% Off', 'percentage', 50.00, 1),
        ('full_comp', 'Full Comp 100%', 'percentage', 100.00, 1)`);
    console.log('✓ Seeded discount_types data');
} catch(e) { 
    console.log('  discount_types:', e.message); 
}

// Create discount_applications table
try {
    db.exec(`CREATE TABLE IF NOT EXISTS discount_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        order_item_id INTEGER,
        discount_type_id INTEGER,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        discount_amount_cents INTEGER NOT NULL,
        original_amount_cents INTEGER NOT NULL,
        reason TEXT,
        applied_by INTEGER NOT NULL,
        approved_by INTEGER,
        applied_at TEXT DEFAULT (datetime('now'))
    )`);
    console.log('✓ Created discount_applications table');
} catch(e) { 
    console.log('  discount_applications:', e.message); 
}

// Update admin user with password and full permissions
const hash = bcrypt.hashSync('admin123', 10);
const perms = JSON.stringify({
    void_item: true,
    discount_item: true,
    comp_item: true,
    order_discount: true,
    manager_override: true,
    view_reports: true,
    manage_users: true
});

try {
    db.prepare('UPDATE users SET password_hash = ?, permissions = ? WHERE username = ?').run(hash, perms, 'admin');
    console.log('✓ Updated admin user with password and permissions');
} catch(e) {
    console.log('  admin update:', e.message);
}

db.close();
console.log('\n✅ Database patch complete!');
