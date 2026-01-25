const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { dbAsync, getConnectionStatus, healthCheck: dbHealthCheck } = require('./db');
const { runMigrations } = require('./runMigrations');
const { printReceipt, printKitchenTicket, printDailyReport, printRawText, getPrinterStatus } = require('./printer');

const app = express();
const port = process.env.POS_PORT || 5000;
const serverStartTime = new Date().toISOString();  // Captured once at startup

// JWT Secret - use environment variable or generate a secure random key
// IMPORTANT: In production, always set JWT_SECRET environment variable!
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
    console.warn('⚠️  WARNING: JWT_SECRET not set in environment. Using random key (sessions will invalidate on restart).');
}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    }
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Basic routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/api/health', async (req, res) => {
    const dbStatus = getConnectionStatus();
    const status = dbStatus.isConnected ? 'OK' : 'DEGRADED';
    
    res.json({ 
        status, 
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - new Date(serverStartTime).getTime()) / 1000),
        database: {
            connected: dbStatus.isConnected,
            poolTotal: dbStatus.poolTotalCount,
            poolIdle: dbStatus.poolIdleCount,
            poolWaiting: dbStatus.poolWaitingCount
        }
    });
});

// Database reconnect endpoint (for admin use)
app.post('/api/db/reconnect', async (req, res) => {
    try {
        const success = await dbHealthCheck();
        if (success) {
            res.json({ success: true, message: 'Database connection verified' });
        } else {
            res.status(503).json({ success: false, message: 'Database reconnection in progress' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Products API
app.get('/api/products', async (req, res) => {
    try {
        const products = await dbAsync.all(
            'SELECT id, name, base_price, base_price_cents, category_id FROM products WHERE is_active = true'
        );
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load products', details: error.message });
    }
});

// Create a new product
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        const priceCents = dollarsToCents(Number(price));
        const categoryId = category || null;
        
        const result = await dbAsync.run(
            `INSERT INTO products (name, base_price, base_price_cents, category_id, is_active, organization_id)
             VALUES (?, ?, ?, ?, true, 1)`,
            [name, Number(price), priceCents, categoryId]
        );
        
        const newProduct = await dbAsync.get('SELECT id, name, base_price, base_price_cents, category_id FROM products WHERE id = ?', [result.lastID]);
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create product', details: error.message });
    }
});

// Update a product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, category } = req.body;
        
        const existing = await dbAsync.get('SELECT id FROM products WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (price !== undefined) {
            updates.push('base_price = ?', 'base_price_cents = ?');
            values.push(Number(price), dollarsToCents(Number(price)));
        }
        if (category !== undefined) {
            updates.push('category_id = ?');
            values.push(category || null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        await dbAsync.run(
            `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        const updated = await dbAsync.get('SELECT id, name, base_price, base_price_cents, category_id FROM products WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
});

// Delete a product (soft delete - set is_active = false)
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const existing = await dbAsync.get('SELECT id, name FROM products WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        await dbAsync.run(
            'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
        
        res.json({ success: true, message: `Product "${existing.name}" removed` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete product', details: error.message });
    }
});

// Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await dbAsync.all(
            'SELECT id, name FROM categories WHERE is_active = true ORDER BY sort_order, name'
        );
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load categories', details: error.message });
    }
});

// Add or update category
app.post('/api/categories', async (req, res) => {
    try {
        const { name, sortOrder } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Category name required' });
        }
        const result = await dbAsync.run(
            'INSERT INTO categories (name, sort_order, is_active) VALUES (?, ?, true)',
            [name, sortOrder || 0]
        );
        res.json({ id: result.lastID, name, sortOrder: sortOrder || 0 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category', details: error.message });
    }
});

// Delete category (soft delete)
app.delete('/api/categories/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await dbAsync.run('UPDATE categories SET is_active = false WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete category', details: error.message });
    }
});

// Build info - secured for production
// In production: requires admin auth OR ENABLE_DIAGNOSTICS=true
// Sensitive paths (serverPath, db*) are always hidden in production
app.get('/build/info', (req, res) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const diagnosticsEnabled = process.env.ENABLE_DIAGNOSTICS === 'true';
    
    // In production, require auth or explicit enable flag
    if (isProduction && !diagnosticsEnabled) {
        // Check for admin auth header (simple token-based auth)
        const authHeader = req.headers['x-admin-token'];
        const expectedToken = process.env.ADMIN_DIAGNOSTICS_TOKEN;
        
        if (!expectedToken || authHeader !== expectedToken) {
            return res.status(403).json({
                error: 'Diagnostics endpoint disabled in production',
                hint: 'Set ENABLE_DIAGNOSTICS=true or provide X-Admin-Token header'
            });
        }
    }
    
    const response = {
        version: '1.0.0',
        hardenedVersion: '2.0.0',  // v2 = audit-safe history pattern
        moneyFormat: 'integer_cents',
        historyPattern: 'append_only',
        port: port,
        nodeVersion: process.version,
        startedAt: serverStartTime,
    };
    
    // Only include sensitive info in non-production environments
    if (!isProduction) {
        response.serverPath = __filename;
        response.dbHost = process.env.PG_HOST || 'localhost';
        response.dbPort = process.env.PG_PORT || 5433;
        response.dbName = process.env.PG_DATABASE || 'universal_pos';
        response.environment = 'development';
    } else {
        response.environment = 'production';
    }
    
    res.json(response);
});

// ============================================================================
// MONEY SAFETY: All currency operations use integer cents (minor units)
// ============================================================================

/**
 * Convert dollars to cents (integer). Rounds to nearest cent.
 * @param {number|string} dollars - Amount in dollars
 * @returns {number} Amount in cents as integer
 */
function dollarsToCents(dollars) {
    if (dollars === null || dollars === undefined) return 0;
    // Use Math.round to handle floating point edge cases like 19.99 * 100 = 1998.9999999
    return Math.round(Number(dollars) * 100);
}

/**
 * Convert cents to dollars for display purposes only.
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
function centsToDollars(cents) {
    if (cents === null || cents === undefined) return 0;
    return Number(cents) / 100;
}

/**
 * Calculate tax in cents using integer math.
 * @param {number} subtotalCents - Subtotal in cents
 * @param {number} taxRateBps - Tax rate in basis points (0 = 0%, 1000 = 10%)
 * @returns {number} Tax amount in cents
 */
function calculateTaxCents(subtotalCents, taxRateBps = 0) {
    // 0 = no tax (default), 1000 basis points = 10%
    // (subtotal * rate) / 10000 gives us the tax in cents
    return Math.round((subtotalCents * taxRateBps) / 10000);
}

// Test database connection
app.get('/api/db-test', async (req, res) => {
    try {
        const result = await dbAsync.get('SELECT COUNT(*) as count FROM users');
        res.json({ status: 'Database connected', userCount: result.count });
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
});

async function getDefaultOrgId() {
    const org = await dbAsync.get('SELECT id FROM organizations WHERE code = ?', ['DEFAULT']);
    return org ? org.id : null;
}

async function getDefaultLocationId() {
    const location = await dbAsync.get('SELECT id FROM locations WHERE code = ?', ['MAIN']);
    return location ? location.id : null;
}

async function getUserIdFromUsername(username) {
    if (!username) return null;
    const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
    return user ? user.id : null;
}

/**
 * Get user with full details including permissions
 */
async function getUserByUsername(username) {
    if (!username) return null;
    return dbAsync.get(
        `SELECT id, username, role, permissions 
         FROM users WHERE username = ? AND is_active = 1`,
        [username]
    );
}

/**
 * Check if user has a specific permission
 * Admins have all permissions, others check role + explicit permissions
 */
function userHasPermission(user, permission) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    // Check explicit permissions in user's permissions JSONB
    const perms = typeof user.permissions === 'string' 
        ? JSON.parse(user.permissions || '{}') 
        : (user.permissions || {});
    
    if (perms[permission] === true) return true;
    
    // Check role-based default permissions
    const roleDefaults = {
        manager: ['void_item', 'discount_item', 'comp_item', 'order_discount', 'manager_override'],
        cashier: ['void_item', 'discount_item', 'order_discount'],
        server: ['void_item', 'discount_item', 'order_discount'],
        kitchen: [],
    };
    
    const defaultPerms = roleDefaults[user.role] || [];
    return defaultPerms.includes(permission);
}

/**
 * Permission middleware factory
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        const username = req.body?.userId || req.headers['x-user-id'];
        if (!username) {
            return res.status(401).json({ error: 'User identification required' });
        }
        
        const user = await getUserByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        if (!userHasPermission(user, permission)) {
            return res.status(403).json({ 
                error: `Permission denied: ${permission} required`,
                requiredPermission: permission,
                userRole: user.role
            });
        }
        
        req.user = user;
        next();
    };
}

function getRequestMetadata(req) {
    return {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
    };
}

function getIdempotencyKey(req) {
    return req.headers['idempotency-key'] || (req.body && req.body.idempotencyKey) || null;
}

function hashRequest(req) {
    const payload = {
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query,
        body: req.body,
    };
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function runInTransaction(action) {
    await dbAsync.run('BEGIN');
    try {
        const result = await action();
        await dbAsync.run('COMMIT');
        return result;
    } catch (error) {
        await dbAsync.run('ROLLBACK');
        throw error;
    }
}

/**
 * Race-proof transactional action with idempotency.
 * Uses INSERT ... ON CONFLICT DO NOTHING + SELECT ... FOR UPDATE pattern
 * to prevent race conditions in concurrent requests.
 */
async function runTransactionalAction(action, req, handler) {
    const idempotencyKey = getIdempotencyKey(req);
    const requestHash = idempotencyKey ? hashRequest(req) : null;

    return runInTransaction(async () => {
        if (idempotencyKey) {
            // RACE-PROOF: Use INSERT ... ON CONFLICT DO NOTHING
            // This atomically inserts only if not exists, preventing race between check and insert
            await dbAsync.run(
                `INSERT INTO idempotency_keys (idempotency_key, action, request_hash, locked_at, locked_by)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
                 ON CONFLICT (idempotency_key, action) DO NOTHING`,
                [idempotencyKey, action, requestHash, `pid-${process.pid}`]
            );

            // RACE-PROOF: SELECT ... FOR UPDATE locks the row for this transaction
            // Other concurrent transactions will block here until we commit/rollback
            const existing = await dbAsync.get(
                `SELECT id, request_hash, response_status, response_body, locked_at
                 FROM idempotency_keys
                 WHERE idempotency_key = ? AND action = ?
                 FOR UPDATE`,
                [idempotencyKey, action]
            );

            if (!existing) {
                // This shouldn't happen after our insert, but handle it gracefully
                throw createHttpError(500, 'Idempotency key insert failed unexpectedly');
            }

            // Check for request hash mismatch (key reuse with different payload)
            if (existing.request_hash !== requestHash) {
                throw createHttpError(409, 'Idempotency key reuse with different request.');
            }

            // If already completed, return cached response (replay)
            if (existing.response_status !== null) {
                let cachedBody = {};
                if (existing.response_body) {
                    try {
                        cachedBody = JSON.parse(existing.response_body);
                    } catch (parseError) {
                        cachedBody = { error: 'Failed to parse cached response.' };
                    }
                }
                return { replay: true, status: existing.response_status, body: cachedBody };
            }

            // Row is locked by us, we can proceed with the operation
        }

        // Execute the actual handler
        const response = await handler();

        // Store response for future replay
        if (idempotencyKey) {
            await dbAsync.run(
                `UPDATE idempotency_keys
                 SET response_status = ?, response_body = ?, updated_at = CURRENT_TIMESTAMP, locked_at = NULL
                 WHERE idempotency_key = ? AND action = ?`,
                [response.status, JSON.stringify(response.body), idempotencyKey, action]
            );
        }

        return { replay: false, ...response };
    });
}

async function logAuditEntry({ organizationId, userId, locationId, action, entityType, entityId, oldValues, newValues, metadata }) {
    // Ensure entityId is never null - use 0 as fallback for system-level events
    const safeEntityId = entityId || locationId || 1;
    
    await dbAsync.run(
        `INSERT INTO audit_log (
            organization_id,
            user_id,
            location_id,
            action,
            entity_type,
            entity_id,
            old_values,
            new_values,
            metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            organizationId || null,
            userId || null,
            locationId || null,
            action,
            entityType,
            safeEntityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            metadata ? JSON.stringify(metadata) : null,
        ]
    );
}

async function getLatestTableStatus(tableId) {
    // AUDIT-SAFE: Only get active status row (where ended_at IS NULL)
    // Fallback to most recent if no active row exists
    const activeStatus = await dbAsync.get(
        `SELECT status, order_id as orderId
         FROM table_statuses
         WHERE table_id = ? AND ended_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [tableId]
    );
    
    if (activeStatus) return activeStatus;
    
    // Fallback: get most recent status regardless of ended_at
    return dbAsync.get(
        `SELECT status, order_id as orderId
         FROM table_statuses
         WHERE table_id = ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [tableId]
    );
}

async function ensureDefaultFloorPlan() {
    const locationId = await getDefaultLocationId();
    let floorPlan = await dbAsync.get('SELECT id FROM floor_plans WHERE location_id = ? AND is_active = 1', [locationId]);
    if (floorPlan) return floorPlan.id;

    const result = await dbAsync.run(
        'INSERT INTO floor_plans (location_id, name, description, is_active) VALUES (?, ?, ?, true)',
        [locationId, 'Main Floor', 'Default floor plan']
    );
    return result.lastID;
}

async function ensureDefaultTables() {
    const tableCount = await dbAsync.get('SELECT COUNT(*) as count FROM tables');
    if (tableCount && tableCount.count > 0) return;

    const floorPlanId = await ensureDefaultFloorPlan();
    for (let i = 1; i <= 10; i++) {
        const tableResult = await dbAsync.run(
            'INSERT INTO tables (floor_plan_id, table_number, name, capacity, shape, is_active) VALUES (?, ?, ?, ?, ?, true)',
            [floorPlanId, String(i), `Table ${i}`, 4, 'round']
        );
        await dbAsync.run(
            'INSERT INTO table_statuses (table_id, status, notes) VALUES (?, ?, ?)',
            [tableResult.lastID, 'available', 'Initial status']
        );
    }
}

async function ensureAdminUser() {
    const existing = await dbAsync.get('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existing) return;

    const passwordHash = await bcrypt.hash('admin123', 10);
    const organizationId = await getDefaultOrgId();

    await dbAsync.run(
        'INSERT INTO users (organization_id, username, password_hash, role, is_active) VALUES (?, ?, ?, ?, true)',
        [organizationId, 'admin', passwordHash, 'admin']
    );
}

async function ensureSampleCatalog() {
    const productCount = await dbAsync.get('SELECT COUNT(*) as count FROM products');
    if (productCount && productCount.count > 0) return;

    const organizationId = await getDefaultOrgId();
    const categories = [
        { name: 'Food', description: 'Prepared meals and dishes' },
        { name: 'Beverages', description: 'Drinks and refreshments' },
        { name: 'Other', description: 'Miscellaneous items' },
    ];

    const categoryIds = {};
    for (const category of categories) {
        const result = await dbAsync.run(
            'INSERT INTO categories (organization_id, name, description) VALUES (?, ?, ?)',
            [organizationId, category.name, category.description]
        );
        categoryIds[category.name] = result.lastID;
    }

    const products = [
        { name: 'Burger', description: 'Classic beef burger', price: 8.99, category: 'Food' },
        { name: 'Pizza', description: 'Cheese pizza', price: 12.99, category: 'Food' },
        { name: 'Coffee', description: 'Hot coffee', price: 2.50, category: 'Beverages' },
        { name: 'Soda', description: 'Cold soda', price: 1.99, category: 'Beverages' },
        { name: 'T-Shirt', description: 'Cotton t-shirt', price: 15.99, category: 'Other' },
    ];

    for (const product of products) {
        const priceCents = dollarsToCents(product.price);
        await dbAsync.run(
            `INSERT INTO products (organization_id, category_id, name, description, base_price, base_price_cents, tax_rate, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 0.08, true)`,
            [organizationId, categoryIds[product.category], product.name, product.description, product.price, priceCents]
        );
    }
}

async function ensureReservationTypes() {
    const count = await dbAsync.get('SELECT COUNT(*) as count FROM reservation_types');
    if (count && count.count > 0) return;

    const organizationId = await getDefaultOrgId();
    await dbAsync.run(
        `INSERT INTO reservation_types (organization_id, name, description, default_duration, requires_deposit, is_active)
         VALUES (?, ?, ?, ?, false, true)`,
        [organizationId, 'Standard', 'Default reservation type', 90]
    );
}

async function ensureKitchenStations() {
    const count = await dbAsync.get('SELECT COUNT(*) as count FROM kitchen_stations');
    if (count && count.count > 0) return;

    const locationId = await getDefaultLocationId();
    await dbAsync.run(
        'INSERT INTO kitchen_stations (location_id, name, type, is_active) VALUES (?, ?, ?, true)',
        [locationId, 'Main Kitchen', 'kitchen']
    );
    await dbAsync.run(
        'INSERT INTO kitchen_stations (location_id, name, type, is_active) VALUES (?, ?, ?, true)',
        [locationId, 'Bar', 'bar']
    );
}

async function ensureMenuItems() {
    const count = await dbAsync.get('SELECT COUNT(*) as count FROM menu_items');
    if (count && count.count > 0) return;

    const kitchen = await dbAsync.get('SELECT id FROM kitchen_stations WHERE name = ?', ['Main Kitchen']);
    const bar = await dbAsync.get('SELECT id FROM kitchen_stations WHERE name = ?', ['Bar']);

    const products = await dbAsync.all(
        `SELECT p.id, c.name as category
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id`
    );

    for (const product of products) {
        const category = (product.category || '').toLowerCase();
        const stationId = category === 'beverages' ? (bar ? bar.id : null) : (kitchen ? kitchen.id : null);
        if (!stationId) continue;

        await dbAsync.run(
            `INSERT INTO menu_items (product_id, kitchen_station_id, prep_time, cook_time, is_active)
             VALUES (?, ?, 5, 10, true)`,
            [product.id, stationId]
        );
    }
}

async function ensureSeedData() {
    await ensureAdminUser();
    await ensureSampleCatalog();
    await ensureDefaultTables();
    await ensureReservationTypes();
    await ensureKitchenStations();
    await ensureMenuItems();
}

// Auth routes
app.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await dbAsync.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await dbAsync.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/auth/logout', (req, res) => {
    res.json({ success: true });
});

// Validate session/token for session restoration
app.post('/auth/validate', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '') || sessionId;
        
        if (!token) {
            return res.json({ valid: false });
        }
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Verify user still exists
            const user = await dbAsync.get('SELECT id, username, full_name, role FROM users WHERE id = ?', [decoded.userId]);
            if (user) {
                return res.json({ valid: true, user });
            }
        } catch (e) {
            // Token invalid or expired
        }
        
        res.json({ valid: false });
    } catch (error) {
        res.json({ valid: false });
    }
});

// Restaurant module routes
app.get('/restaurant/tables', async (req, res) => {
    try {
        // AUDIT-SAFE: Only get active status rows (ended_at IS NULL)
        const tables = await dbAsync.all(
            `SELECT
                t.id,
                t.table_number,
                t.name,
                t.capacity,
                t.shape,
                COALESCE(ts.status, 'available') as status,
                ts.order_id as order_id,
                o.guest_count as guest_count
             FROM tables t
             LEFT JOIN table_statuses ts ON ts.id = (
                 SELECT id FROM table_statuses
                 WHERE table_id = t.id AND ended_at IS NULL
                 ORDER BY created_at DESC
                 LIMIT 1
             )
             LEFT JOIN orders o ON o.id = ts.order_id
             WHERE t.is_active = 1
             ORDER BY t.table_number`
        );

        // Fetch order items for tables that have active orders
        for (const table of tables) {
            if (table.order_id && ['seated', 'billed'].includes(table.status)) {
                const items = await dbAsync.all(
                    `SELECT oi.id, oi.quantity, oi.status, p.name as product_name,
                            oi.unit_price_cents, oi.total_price_cents
                     FROM order_items oi
                     JOIN products p ON p.id = oi.product_id
                     WHERE oi.order_id = ? AND oi.status != 'voided'
                     ORDER BY oi.created_at`,
                    [table.order_id]
                );
                table.items = items;
            } else {
                table.items = [];
            }
        }

        res.json(tables);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load tables', details: error.message });
    }
});

app.post('/restaurant/tables', async (req, res) => {
    try {
        const { tableNumber, name, capacity, shape } = req.body;
        if (!tableNumber) {
            res.status(400).json({ error: 'Table number is required' });
            return;
        }

        const result = await runTransactionalAction('tables.create', req, async () => {
            const floorPlanId = await ensureDefaultFloorPlan();
            const tableResult = await dbAsync.run(
                'INSERT INTO tables (floor_plan_id, table_number, name, capacity, shape, is_active) VALUES (?, ?, ?, ?, ?, true)',
                [
                    floorPlanId,
                    String(tableNumber),
                    name || `Table ${tableNumber}`,
                    Number(capacity) || 4,
                    shape || 'round',
                ]
            );

            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, notes) VALUES (?, ?, ?)',
                [tableResult.lastID, 'available', 'Initial status']
            );

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'table.created',
                entityType: 'table',
                entityId: tableResult.lastID,
                oldValues: null,
                newValues: {
                    table_number: String(tableNumber),
                    name: name || `Table ${tableNumber}`,
                    capacity: Number(capacity) || 4,
                    shape: shape || 'round',
                    status: 'available',
                },
                metadata: getRequestMetadata(req),
            });

            return { status: 201, body: { id: tableResult.lastID } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to create table', details: error.message });
    }
});

// UPDATE table (name, capacity, shape) - only if table is available
app.put('/restaurant/tables/:id', async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { name, capacity, shape } = req.body;

        const result = await runTransactionalAction(`tables.update.${tableId}`, req, async () => {
            // Lock the table first, then get status
            const table = await dbAsync.get(
                'SELECT * FROM tables WHERE id = ? FOR UPDATE',
                [tableId]
            );

            if (!table) {
                throw { status: 404, message: 'Table not found' };
            }

            // Get current status separately
            const tableStatus = await dbAsync.get(
                'SELECT status FROM table_statuses WHERE table_id = ? AND ended_at IS NULL',
                [tableId]
            );
            const currentStatus = tableStatus?.status || 'available';

            // Only allow editing if table is available or blocked
            if (!['available', 'blocked'].includes(currentStatus)) {
                throw { status: 409, message: `Cannot edit table while status is "${currentStatus}"` };
            }

            const oldValues = { name: table.name, capacity: table.capacity, shape: table.shape };
            const newName = name || table.name;
            const newCapacity = capacity !== undefined ? Number(capacity) : table.capacity;
            const newShape = shape || table.shape;

            await dbAsync.run(
                'UPDATE tables SET name = ?, capacity = ?, shape = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newName, newCapacity, newShape, tableId]
            );

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'table.updated',
                entityType: 'table',
                entityId: tableId,
                oldValues,
                newValues: { name: newName, capacity: newCapacity, shape: newShape },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { success: true, id: tableId } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update table', details: error.message });
    }
});

// DELETE table - only if table is available
app.delete('/restaurant/tables/:id', async (req, res) => {
    try {
        const tableId = Number(req.params.id);

        const result = await runTransactionalAction(`tables.delete.${tableId}`, req, async () => {
            // Lock the table first
            const table = await dbAsync.get(
                'SELECT * FROM tables WHERE id = ? FOR UPDATE',
                [tableId]
            );

            if (!table) {
                throw { status: 404, message: 'Table not found' };
            }
            
            // Get current status separately
            const statusRow = await dbAsync.get(
                'SELECT status FROM table_statuses WHERE table_id = ? AND ended_at IS NULL',
                [tableId]
            );
            const status = statusRow?.status || 'available';

            // Only allow deleting if table is available or blocked
            if (!['available', 'blocked'].includes(status)) {
                throw { status: 409, message: `Cannot delete table while status is "${status}"` };
            }

            // Soft delete - mark as inactive
            await dbAsync.run(
                'UPDATE tables SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [tableId]
            );

            // Close the current status
            await dbAsync.run(
                'UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP WHERE table_id = ? AND ended_at IS NULL',
                [tableId]
            );

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'table.deleted',
                entityType: 'table',
                entityId: tableId,
                oldValues: { name: table.name, capacity: table.capacity, is_active: true },
                newValues: { is_active: false },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { success: true } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to delete table', details: error.message });
    }
});

app.post('/restaurant/tables/:id/seat', async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { userId, guestCount } = req.body;
        const result = await runTransactionalAction(`tables.seat.${tableId}`, req, async () => {
            // CONCURRENCY SAFETY: Lock the table row to prevent double-seat
            const table = await dbAsync.get(
                'SELECT id FROM tables WHERE id = ? AND is_active = 1 FOR UPDATE',
                [tableId]
            );
            if (!table) {
                throw createHttpError(404, 'Table not found');
            }

            // Check current status - AUDIT-SAFE: only check active rows (ended_at IS NULL)
            const latestStatus = await dbAsync.get(
                `SELECT status, order_id as orderId
                 FROM table_statuses
                 WHERE table_id = ? AND ended_at IS NULL
                 ORDER BY created_at DESC
                 LIMIT 1
                 FOR UPDATE`,
                [tableId]
            );
            
            // If no active status, table is available; otherwise check if status allows seating
            if (latestStatus && !['available', 'reserved'].includes(latestStatus.status)) {
                throw createHttpError(409, 'Table is not available for seating.');
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);
            const count = Number(guestCount) || 1;
            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            // MONEY SAFETY: Initialize with integer cents (0)
            const orderResult = await dbAsync.run(
                `INSERT INTO orders (
                    organization_id,
                    location_id,
                    user_id,
                    table_id,
                    order_number,
                    status,
                    order_type,
                    guest_count,
                    subtotal,
                    tax_amount,
                    total_amount,
                    subtotal_cents,
                    tax_amount_cents,
                    total_amount_cents
                ) VALUES (?, ?, ?, ?, ?, 'open', 'dine_in', ?, 0, 0, 0, 0, 0, 0)`,
                [organizationId, locationId, userDbId, tableId, orderNumber, count]
            );

            // AUDIT-SAFE: Close out any previous status row before inserting new one
            await dbAsync.run(
                `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                 WHERE table_id = ? AND ended_at IS NULL`,
                [tableId]
            );

            // This insert will fail if unique index idx_table_unique_active_seat is violated
            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [tableId, 'seated', orderResult.lastID, userDbId, 'Seated']
            );

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.seated',
                entityType: 'table',
                entityId: tableId,
                oldValues: latestStatus || null,
                newValues: { status: 'seated', order_id: orderResult.lastID },
                metadata: getRequestMetadata(req),
            });

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'order.created',
                entityType: 'order',
                entityId: orderResult.lastID,
                oldValues: null,
                newValues: {
                    order_number: orderNumber,
                    table_id: tableId,
                    status: 'open',
                    total_amount: 0,
                },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { tableId, orderId: orderResult.lastID, orderNumber } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        // Check for unique constraint violation (double-seat attempt)
        if (error.message && error.message.includes('idx_table_unique_active_seat')) {
            res.status(409).json({ error: 'Table is already seated by another request' });
            return;
        }
        res.status(500).json({ error: 'Failed to seat table', details: error.message });
    }
});

app.post('/restaurant/tables/:id/status', async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { status, userId, notes } = req.body;
        const allowed = ['available', 'seated', 'reserved', 'billed', 'needs_cleaning', 'blocked'];
        if (!allowed.includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }

        const result = await runTransactionalAction(`tables.status.${tableId}`, req, async () => {
            const table = await dbAsync.get('SELECT id FROM tables WHERE id = ? AND is_active = 1 FOR UPDATE', [tableId]);
            if (!table) {
                throw createHttpError(404, 'Table not found');
            }

            const latestStatus = await getLatestTableStatus(tableId);
            const currentStatus = latestStatus?.status || 'available';

            // State machine guard: Define valid transitions
            const validTransitions = {
                'available': ['reserved', 'seated', 'blocked'],
                'reserved': ['seated', 'available', 'blocked'],
                'seated': ['billed'],
                'billed': ['needs_cleaning'],
                'needs_cleaning': ['available'],
                'blocked': ['available'],
            };

            if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
                throw createHttpError(409, `Cannot transition table from '${currentStatus}' to '${status}'`);
            }

            if (status === 'available' && latestStatus && latestStatus.orderId) {
                const order = await dbAsync.get('SELECT status FROM orders WHERE id = ?', [latestStatus.orderId]);
                if (order && !['paid', 'closed', 'voided'].includes(order.status)) {
                    throw createHttpError(409, 'Active order must be closed before freeing table.');
                }
            }

            const userDbId = await getUserIdFromUsername(userId);
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            // AUDIT-SAFE HISTORY: When transitioning away from 'seated', close out the current row
            // Instead of DELETE, we UPDATE ended_at to preserve full audit trail
            if (currentStatus === 'seated' && status !== 'seated') {
                await dbAsync.run(
                    `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                     WHERE table_id = ? AND status = 'seated' AND ended_at IS NULL`,
                    [tableId]
                );
            }
            
            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [tableId, status, latestStatus ? latestStatus.orderId : null, userDbId, notes || 'Status updated']
            );

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.status_changed',
                entityType: 'table',
                entityId: tableId,
                oldValues: latestStatus || null,
                newValues: { status, order_id: latestStatus ? latestStatus.orderId : null },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { tableId, status, previousStatus: currentStatus } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update table status', details: error.message });
    }
});

app.post('/restaurant/tables/:id/clear', async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { userId } = req.body;
        const result = await runTransactionalAction(`tables.clear.${tableId}`, req, async () => {
            const table = await dbAsync.get('SELECT id FROM tables WHERE id = ? AND is_active = 1', [tableId]);
            if (!table) {
                throw createHttpError(404, 'Table not found');
            }
            const userDbId = await getUserIdFromUsername(userId);
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const latestStatus = await getLatestTableStatus(tableId);

            if (latestStatus && latestStatus.orderId) {
                const order = await dbAsync.get('SELECT status FROM orders WHERE id = ?', [latestStatus.orderId]);
                if (order && !['paid', 'closed', 'voided'].includes(order.status)) {
                    throw createHttpError(409, 'Order must be paid or closed before clearing the table.');
                }
            }

            // AUDIT-SAFE HISTORY: Close out previous status row before inserting 'available'
            await dbAsync.run(
                `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                 WHERE table_id = ? AND ended_at IS NULL`,
                [tableId]
            );

            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [tableId, 'available', null, userDbId, 'Cleared']
            );

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.cleared',
                entityType: 'table',
                entityId: tableId,
                oldValues: latestStatus || null,
                newValues: { status: 'available' },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { tableId, status: 'available' } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to clear table', details: error.message });
    }
});

// Unseat table - for walk-in customers who leave before ordering
app.post('/restaurant/tables/:id/unseat', async (req, res) => {
    try {
        const tableId = Number(req.params.id);
        const { userId } = req.body;
        const result = await runTransactionalAction(`tables.unseat.${tableId}`, req, async () => {
            const table = await dbAsync.get('SELECT id FROM tables WHERE id = ? AND is_active = 1 FOR UPDATE', [tableId]);
            if (!table) {
                throw createHttpError(404, 'Table not found');
            }
            
            const latestStatus = await dbAsync.get(
                `SELECT status, order_id as orderId FROM table_statuses 
                 WHERE table_id = ? AND ended_at IS NULL 
                 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
                [tableId]
            );
            
            if (!latestStatus || latestStatus.status !== 'seated') {
                throw createHttpError(409, 'Table is not seated');
            }
            
            // Check if order has any items
            if (latestStatus.orderId) {
                const itemCount = await dbAsync.get(
                    `SELECT COUNT(*) as count FROM order_items 
                     WHERE order_id = ? AND status != 'voided'`,
                    [latestStatus.orderId]
                );
                if (itemCount && itemCount.count > 0) {
                    throw createHttpError(409, 'Cannot unseat - table has ordered items. Use bill flow instead.');
                }
                
                // Cancel the empty order
                await dbAsync.run(
                    `UPDATE orders SET status = 'voided', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [latestStatus.orderId]
                );
            }
            
            const userDbId = await getUserIdFromUsername(userId);
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            // Close out the seated status
            await dbAsync.run(
                `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                 WHERE table_id = ? AND ended_at IS NULL`,
                [tableId]
            );
            
            // Insert available status
            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [tableId, 'available', null, userDbId, 'Walk-in customer left before ordering']
            );
            
            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.unseated',
                entityType: 'table',
                entityId: tableId,
                oldValues: { status: 'seated', order_id: latestStatus.orderId },
                newValues: { status: 'available', order_id: null },
                metadata: getRequestMetadata(req),
            });
            
            return { status: 200, body: { tableId, status: 'available' } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to unseat table', details: error.message });
    }
});

app.get('/restaurant/reservations', async (req, res) => {
    try {
        const { date } = req.query;
        const locationId = await getDefaultLocationId();
        const params = [locationId];
        let dateClause = '';
        if (date) {
            dateClause = 'AND requested_date = ?';
            params.push(date);
        }

        const reservations = await dbAsync.all(
            `SELECT r.*, t.table_number as table_number, rt.name as reservation_type
             FROM reservations r
             LEFT JOIN tables t ON t.id = r.table_id
             LEFT JOIN reservation_types rt ON rt.id = r.reservation_type_id
             WHERE r.location_id = ?
             ${dateClause}
             ORDER BY r.requested_date, r.requested_time`,
            params
        );

        res.json(reservations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load reservations', details: error.message });
    }
});

app.post('/restaurant/reservations', async (req, res) => {
    try {
        const {
            customerName,
            customerPhone,
            customerEmail,
            partySize,
            requestedDate,
            requestedTime,
            duration,
            reservationTypeId,
            tableId,
            userId,
            notes,
        } = req.body;

        if (!customerName || !requestedDate || !requestedTime || !partySize || !duration) {
            res.status(400).json({ error: 'Customer name, date, time, party size, and duration are required' });
            return;
        }

        const result = await runTransactionalAction('reservations.create', req, async () => {
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);
            const typeId = reservationTypeId || (await dbAsync.get('SELECT id FROM reservation_types LIMIT 1'))?.id;

            const latestStatus = tableId ? await getLatestTableStatus(tableId) : null;
            if (tableId) {
                if (latestStatus && latestStatus.status !== 'available') {
                    throw createHttpError(409, 'Table is not available for reservation.');
                }
            }

            const reservationResult = await dbAsync.run(
                `INSERT INTO reservations (
                    location_id,
                    reservation_type_id,
                    customer_name,
                    customer_phone,
                    customer_email,
                    party_size,
                    requested_date,
                    requested_time,
                    duration,
                    special_requests,
                    status,
                    table_id,
                    assigned_staff,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                [
                    locationId,
                    typeId || null,
                    customerName,
                    customerPhone || null,
                    customerEmail || null,
                    Number(partySize),
                    requestedDate,
                    requestedTime,
                    Number(duration),
                    notes || null,
                    tableId || null,
                    userDbId,
                    userDbId,
                ]
            );

            const organizationId = await getDefaultOrgId();

            if (tableId) {
                await dbAsync.run(
                    'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                    [tableId, 'reserved', null, userDbId, 'Reserved']
                );
                await logAuditEntry({
                    organizationId,
                    userId: userDbId,
                    locationId,
                    action: 'table.reserved',
                    entityType: 'table',
                    entityId: tableId,
                    oldValues: latestStatus || null,
                    newValues: { status: 'reserved' },
                    metadata: getRequestMetadata(req),
                });
            }
            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'reservation.created',
                entityType: 'reservation',
                entityId: reservationResult.lastID,
                oldValues: null,
                newValues: {
                    customer_name: customerName,
                    party_size: Number(partySize),
                    requested_date: requestedDate,
                    requested_time: requestedTime,
                    status: 'pending',
                    table_id: tableId || null,
                },
                metadata: getRequestMetadata(req),
            });

            return { status: 201, body: { id: reservationResult.lastID } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to create reservation', details: error.message });
    }
});

app.post('/restaurant/reservations/:id/status', async (req, res) => {
    try {
        const reservationId = Number(req.params.id);
        const { status, userId } = req.body;
        const allowed = ['pending', 'confirmed', 'arrived', 'seated', 'no_show', 'cancelled', 'completed'];
        if (!allowed.includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }

        const result = await runTransactionalAction(`reservations.status.${reservationId}`, req, async () => {
            const reservation = await dbAsync.get('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
            if (!reservation) {
                throw createHttpError(404, 'Reservation not found');
            }

            const currentStatus = reservation.status;

            // State machine guard: Define valid transitions
            const validTransitions = {
                'pending': ['confirmed', 'cancelled'],
                'confirmed': ['arrived', 'cancelled', 'no_show'],
                'arrived': ['seated'],
                'seated': ['completed'],
                'no_show': [],  // terminal
                'cancelled': [], // terminal
                'completed': [], // terminal
            };

            if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
                throw createHttpError(409, `Cannot transition reservation from '${currentStatus}' to '${status}'`);
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);

            const fields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [status];

            if (status === 'confirmed') {
                fields.push('confirmed_at = CURRENT_TIMESTAMP');
            }
            if (status === 'arrived') {
                fields.push('arrived_at = CURRENT_TIMESTAMP');
            }
            if (status === 'completed') {
                fields.push('completed_at = CURRENT_TIMESTAMP');
            }

            await dbAsync.run(
                `UPDATE reservations SET ${fields.join(', ')} WHERE id = ?`,
                [...params, reservationId]
            );

            if (status === 'confirmed' && reservation.table_id) {
                const latestStatus = await getLatestTableStatus(reservation.table_id);
                if (!latestStatus || latestStatus.status === 'available') {
                    await dbAsync.run(
                        'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                        [reservation.table_id, 'reserved', null, userDbId, 'Reservation confirmed']
                    );
                    await logAuditEntry({
                        organizationId,
                        userId: userDbId,
                        locationId,
                        action: 'table.reserved',
                        entityType: 'table',
                        entityId: reservation.table_id,
                        oldValues: latestStatus || null,
                        newValues: { status: 'reserved' },
                        metadata: getRequestMetadata(req),
                    });
                }
            }

            if (['cancelled', 'no_show', 'completed'].includes(status) && reservation.table_id) {
                const latestTableStatus = await getLatestTableStatus(reservation.table_id);
                // Only free table if it's still reserved (not seated)
                if (latestTableStatus && latestTableStatus.status === 'reserved') {
                    await dbAsync.run(
                        'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                        [reservation.table_id, 'available', null, userDbId, `Reservation ${status}`]
                    );
                    await logAuditEntry({
                        organizationId,
                        userId: userDbId,
                        locationId,
                        action: 'table.available',
                        entityType: 'table',
                        entityId: reservation.table_id,
                        oldValues: { status: latestTableStatus.status },
                        newValues: { status: 'available' },
                        metadata: getRequestMetadata(req),
                    });
                }
            }

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'reservation.status_changed',
                entityType: 'reservation',
                entityId: reservationId,
                oldValues: { status: reservation.status },
                newValues: { status },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { id: reservationId, status, previousStatus: currentStatus } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update reservation', details: error.message });
    }
});

app.post('/restaurant/reservations/:id/assign-table', async (req, res) => {
    try {
        const reservationId = Number(req.params.id);
        const { tableId, userId } = req.body;
        if (!tableId) {
            res.status(400).json({ error: 'Table ID is required' });
            return;
        }

        const result = await runTransactionalAction(`reservations.assign.${reservationId}`, req, async () => {
            const reservation = await dbAsync.get('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
            if (!reservation) {
                throw createHttpError(404, 'Reservation not found');
            }

            const table = await dbAsync.get('SELECT id FROM tables WHERE id = ? AND is_active = 1 FOR UPDATE', [tableId]);
            if (!table) {
                throw createHttpError(404, 'Table not found');
            }

            const userDbId = await getUserIdFromUsername(userId);
            const latestStatus = await getLatestTableStatus(tableId);
            if (latestStatus && latestStatus.status !== 'available') {
                throw createHttpError(409, 'Table is not available for assignment.');
            }

            await dbAsync.run(
                'UPDATE reservations SET table_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [tableId, reservationId]
            );
            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [tableId, 'reserved', null, userDbId, 'Reserved for reservation']
            );

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.reserved',
                entityType: 'table',
                entityId: tableId,
                oldValues: latestStatus || null,
                newValues: { status: 'reserved' },
                metadata: getRequestMetadata(req),
            });
            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'reservation.table_assigned',
                entityType: 'reservation',
                entityId: reservationId,
                oldValues: { table_id: reservation.table_id || null },
                newValues: { table_id: tableId },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { id: reservationId, tableId } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to assign table', details: error.message });
    }
});

app.post('/restaurant/reservations/:id/arrive', async (req, res) => {
    try {
        const reservationId = Number(req.params.id);
        const { userId } = req.body;
        const result = await runTransactionalAction(`reservations.arrive.${reservationId}`, req, async () => {
            const reservation = await dbAsync.get('SELECT * FROM reservations WHERE id = ? FOR UPDATE', [reservationId]);
            if (!reservation) {
                throw createHttpError(404, 'Reservation not found');
            }

            if (!reservation.table_id) {
                throw createHttpError(400, 'Reservation must have a table assigned to seat.');
            }

            const userDbId = await getUserIdFromUsername(userId);
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

            const orderResult = await dbAsync.run(
                `INSERT INTO orders (
                    organization_id,
                    location_id,
                    user_id,
                    table_id,
                    order_number,
                    status,
                    order_type,
                    guest_count,
                    subtotal,
                    tax_amount,
                    total_amount,
                    subtotal_cents,
                    tax_amount_cents,
                    total_amount_cents
                ) VALUES (?, ?, ?, ?, ?, 'open', 'dine_in', ?, 0, 0, 0, 0, 0, 0)`,
                [organizationId, locationId, userDbId, reservation.table_id, orderNumber, reservation.party_size]
            );

            await dbAsync.run(
                'UPDATE reservations SET status = ?, arrived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['arrived', reservationId]
            );

            await dbAsync.run(
                'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                [reservation.table_id, 'seated', orderResult.lastID, userDbId, 'Reservation arrived']
            );

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'table.seated',
                entityType: 'table',
                entityId: reservation.table_id,
                oldValues: { status: reservation.status },
                newValues: { status: 'seated', order_id: orderResult.lastID },
                metadata: getRequestMetadata(req),
            });

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'reservation.arrived',
                entityType: 'reservation',
                entityId: reservationId,
                oldValues: { status: reservation.status },
                newValues: { status: 'arrived', order_id: orderResult.lastID },
                metadata: getRequestMetadata(req),
            });

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'order.created',
                entityType: 'order',
                entityId: orderResult.lastID,
                oldValues: null,
                newValues: {
                    order_number: orderNumber,
                    table_id: reservation.table_id,
                    status: 'open',
                    total_amount: 0,
                },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { reservationId, orderId: orderResult.lastID, orderNumber } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to seat reservation', details: error.message });
    }
});

app.get('/restaurant/waitlist', async (req, res) => {
    try {
        const locationId = await getDefaultLocationId();
        const waitlist = await dbAsync.all(
            `SELECT * FROM waitlist WHERE location_id = ? ORDER BY created_at ASC`,
            [locationId]
        );
        res.json(waitlist);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load waitlist', details: error.message });
    }
});

app.post('/restaurant/waitlist', async (req, res) => {
    try {
        const { customerName, customerPhone, customerEmail, partySize, estimatedWaitTime } = req.body;
        if (!customerName || !partySize) {
            res.status(400).json({ error: 'Customer name and party size are required' });
            return;
        }

        const result = await runTransactionalAction('waitlist.create', req, async () => {
            const locationId = await getDefaultLocationId();
            const entryResult = await dbAsync.run(
                `INSERT INTO waitlist (
                    location_id,
                    customer_name,
                    customer_phone,
                    customer_email,
                    party_size,
                    estimated_wait_time,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, 'waiting')`,
                [
                    locationId,
                    customerName,
                    customerPhone || null,
                    customerEmail || null,
                    Number(partySize),
                    estimatedWaitTime ? Number(estimatedWaitTime) : null,
                ]
            );

            const organizationId = await getDefaultOrgId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'waitlist.created',
                entityType: 'waitlist',
                entityId: entryResult.lastID,
                oldValues: null,
                newValues: {
                    customer_name: customerName,
                    party_size: Number(partySize),
                    status: 'waiting',
                },
                metadata: getRequestMetadata(req),
            });

            return { status: 201, body: { id: entryResult.lastID } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to add waitlist entry', details: error.message });
    }
});

app.post('/restaurant/waitlist/:id/status', async (req, res) => {
    try {
        const waitlistId = Number(req.params.id);
        const { status } = req.body;
        const allowed = ['waiting', 'notified', 'seated', 'cancelled'];
        if (!allowed.includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }

        const result = await runTransactionalAction(`waitlist.status.${waitlistId}`, req, async () => {
            const existing = await dbAsync.get('SELECT status FROM waitlist WHERE id = ?', [waitlistId]);
            if (!existing) {
                throw createHttpError(404, 'Waitlist entry not found');
            }

            await dbAsync.run(
                'UPDATE waitlist SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, waitlistId]
            );

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'waitlist.status_changed',
                entityType: 'waitlist',
                entityId: waitlistId,
                oldValues: { status: existing.status },
                newValues: { status },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { id: waitlistId, status } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update waitlist entry', details: error.message });
    }
});

// Send order items to kitchen
// HARDENED: Uses integer cents for all money calculations
app.post('/restaurant/kitchen/send', async (req, res) => {
    try {
        const { orderId, items, tableId, userId } = req.body;
        
        if (!items || items.length === 0) {
            res.status(400).json({ error: 'No items to send' });
            return;
        }

        // Use idempotency key from header for action identifier, or orderId, or 'new'
        const idempKey = getIdempotencyKey(req);
        const actionId = orderId || (idempKey ? `idemp-${idempKey}` : `new-${Date.now()}`);
        
        const result = await runTransactionalAction(`kitchen.send.${actionId}`, req, async () => {
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);
            
            let orderIdToUse = orderId;
            
            // If no orderId, create a new order
            if (!orderIdToUse) {
                const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const orderResult = await dbAsync.run(
                    `INSERT INTO orders (
                        organization_id, location_id, user_id, table_id, order_number,
                        status, order_type, guest_count, 
                        subtotal, tax_amount, total_amount,
                        subtotal_cents, tax_amount_cents, total_amount_cents
                    ) VALUES (?, ?, ?, ?, ?, 'open', 'dine_in', 1, 0, 0, 0, 0, 0, 0)`,
                    [organizationId, locationId, userDbId, tableId || null, orderNumber]
                );
                orderIdToUse = orderResult.lastID;
            }
            
            const insertedItems = [];
            
            for (const item of items) {
                // MONEY SAFETY: Get price in cents from product
                const product = await dbAsync.get(
                    'SELECT id, base_price, base_price_cents FROM products WHERE id = ?', 
                    [item.productId]
                );
                
                // VALIDATION: Ensure product exists
                if (!product) {
                    throw createHttpError(400, `Product not found: ${item.productId}`);
                }
                
                // Use cents if available, otherwise convert from dollars
                const unitPriceCents = product.base_price_cents || dollarsToCents(product.base_price || 0);
                const totalPriceCents = unitPriceCents * item.quantity;
                
                // Also calculate dollars for backward compatibility
                const unitPrice = centsToDollars(unitPriceCents);
                const totalPrice = centsToDollars(totalPriceCents);
                
                // Insert order item with 'pending' status for kitchen
                const itemResult = await dbAsync.run(
                    `INSERT INTO order_items (
                        order_id, product_id, quantity, 
                        unit_price, total_price, 
                        unit_price_cents, total_price_cents,
                        status, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                    [orderIdToUse, item.productId, item.quantity, unitPrice, totalPrice, unitPriceCents, totalPriceCents, item.notes || '']
                );
                
                insertedItems.push({
                    id: itemResult.lastID,
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitPriceCents,
                    totalPriceCents,
                    status: 'pending'
                });
            }
            
            // MONEY SAFETY: Update order totals using integer cents
            // IMPORTANT: Exclude voided items from totals
            const orderTotals = await dbAsync.get(
                'SELECT SUM(total_price_cents) as subtotal_cents FROM order_items WHERE order_id = ? AND voided_at IS NULL',
                [orderIdToUse]
            );
            const subtotalCents = Number(orderTotals?.subtotal_cents || 0);
            const taxAmountCents = calculateTaxCents(subtotalCents, 0); // No tax
            const totalAmountCents = subtotalCents + taxAmountCents;
            
            // Also update dollars for backward compatibility
            const subtotal = centsToDollars(subtotalCents);
            const taxAmount = centsToDollars(taxAmountCents);
            const totalAmount = centsToDollars(totalAmountCents);
            
            await dbAsync.run(
                `UPDATE orders SET 
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [subtotal, taxAmount, totalAmount, subtotalCents, taxAmountCents, totalAmountCents, orderIdToUse]
            );
            
            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'kitchen.items_sent',
                entityType: 'order',
                entityId: orderIdToUse,
                oldValues: null,
                newValues: { itemCount: items.length, items: insertedItems },
                metadata: getRequestMetadata(req),
            });
            
            // AUTO-PRINT: Print bill to thermal printer after sending to kitchen
            try {
                // Get all items for the order (including previously sent items)
                const allItems = await dbAsync.all(
                    `SELECT oi.*, p.name
                     FROM order_items oi
                     JOIN products p ON p.id = oi.product_id
                     WHERE oi.order_id = ? AND oi.voided_at IS NULL`,
                    [orderIdToUse]
                );
                
                // Get table name
                const tableInfo = tableId ? await dbAsync.get('SELECT name FROM tables WHERE id = ?', [tableId]) : null;
                
                // Get server name
                const serverInfo = userDbId ? await dbAsync.get('SELECT username FROM users WHERE id = ?', [userDbId]) : null;
                
                // Format kitchen order with ONLY new items
                const kitchenOrder = {
                    tableName: tableInfo?.name || 'Walk-in',
                    items: insertedItems.map(item => ({
                        name: item.productName,
                        quantity: item.quantity,
                        notes: items.find(i => i.productId === item.productId)?.notes || ''
                    }))
                };
                
                // Print kitchen ticket first (only new items, centered)
                await printKitchenTicket(kitchenOrder, 'Rio Chicken');
                console.log(`Kitchen ticket printed for order ${orderIdToUse} (${insertedItems.length} new items)`);
                
                // Format customer receipt with ALL items
                const printOrder = {
                    id: orderIdToUse,
                    tableName: tableInfo?.name || 'Walk-in',
                    serverName: serverInfo?.username || 'Staff',
                    items: allItems.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        totalPriceCents: item.total_price_cents,
                        notes: item.notes
                    })),
                    subtotalCents: subtotalCents,
                    taxAmountCents: taxAmountCents,
                    totalAmountCents: totalAmountCents,
                    paymentMethod: null // Not paid yet
                };
                
                // Then print customer receipt (with QR, all items)
                await printReceipt(printOrder, 'Rio Chicken');
                console.log(`Customer receipt printed for order ${orderIdToUse} (${allItems.length} total items)`);
            } catch (printError) {
                // Log but don't fail the request if printing fails
                console.error('Auto-print failed:', printError.message);
            }
            
            return { 
                status: 200, 
                body: { 
                    orderId: orderIdToUse, 
                    itemsSent: insertedItems.length,
                    items: insertedItems 
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to send to kitchen', details: error.message });
    }
});

app.get('/restaurant/kitchen/queue', async (req, res) => {
    try {
        const items = await dbAsync.all(
            `SELECT
                oi.id AS "ticketItemId",
                oi.order_id AS "orderId",
                o.order_number AS "orderNumber",
                o.table_id AS "tableId",
                t.name AS "tableLabel",
                p.name AS "productName",
                oi.quantity,
                oi.status,
                ks.name AS "stationName",
                oi.created_at AS "createdAt"
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             LEFT JOIN tables t ON t.id = o.table_id
             LEFT JOIN products p ON p.id = oi.product_id
             LEFT JOIN menu_items mi ON mi.product_id = oi.product_id AND mi.is_active = 1
             LEFT JOIN kitchen_stations ks ON ks.id = mi.kitchen_station_id
             WHERE oi.status IN ('pending', 'preparing', 'ready', 'served')
               AND o.status NOT IN ('closed', 'voided')
             ORDER BY oi.created_at ASC`
        );

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load kitchen queue', details: error.message });
    }
});

app.post('/restaurant/kitchen/items/:id/status', async (req, res) => {
    try {
        const itemId = Number(req.params.id);
        const { status } = req.body;
        const allowed = ['pending', 'preparing', 'ready', 'served'];
        if (!allowed.includes(status)) {
            res.status(400).json({ error: 'Invalid status' });
            return;
        }

        const result = await runTransactionalAction(`kitchen.item.status.${itemId}`, req, async () => {
            const existing = await dbAsync.get('SELECT status, order_id as orderId FROM order_items WHERE id = ? FOR UPDATE', [itemId]);
            if (!existing) {
                throw createHttpError(404, 'Kitchen item not found');
            }

            // State machine guard: Define valid transitions
            const validTransitions = {
                'pending': ['preparing'],
                'preparing': ['ready'],
                'ready': ['served'],
                'served': [], // terminal state
            };

            const currentStatus = existing.status;
            if (validTransitions[currentStatus] && !validTransitions[currentStatus].includes(status)) {
                throw createHttpError(409, `Cannot transition kitchen item from '${currentStatus}' to '${status}'`);
            }

            await dbAsync.run('UPDATE order_items SET status = ? WHERE id = ?', [status, itemId]);

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'kitchen.item.status_changed',
                entityType: 'order_item',
                entityId: itemId,
                oldValues: { status: existing.status },
                newValues: { status },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { id: itemId, status } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to update kitchen item', details: error.message });
    }
});

// Complete all items for an order (mark as served) - used when all items are ready
app.post('/restaurant/kitchen/orders/:orderId/complete', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);

        const result = await runTransactionalAction(`kitchen.order.complete.${orderId}`, req, async () => {
            // Get all items for this order that are ready
            const items = await dbAsync.all(
                'SELECT id, status FROM order_items WHERE order_id = ? FOR UPDATE',
                [orderId]
            );

            if (!items.length) {
                throw createHttpError(404, 'No items found for this order');
            }

            // Check if all items are ready
            const notReady = items.filter(i => i.status !== 'ready' && i.status !== 'served');
            if (notReady.length > 0) {
                throw createHttpError(409, 'Cannot complete order: not all items are ready');
            }

            // Mark all ready items as served
            const readyItems = items.filter(i => i.status === 'ready');
            for (const item of readyItems) {
                await dbAsync.run('UPDATE order_items SET status = ? WHERE id = ?', ['served', item.id]);
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'kitchen.order.completed',
                entityType: 'order',
                entityId: orderId,
                oldValues: { itemsServed: 0 },
                newValues: { itemsServed: readyItems.length },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { orderId, itemsServed: readyItems.length, message: 'Order completed' } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to complete order', details: error.message });
    }
});

// Reopen a completed order (move all items back to pending)
app.post('/restaurant/kitchen/orders/:orderId/reopen', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);

        const result = await runTransactionalAction(`kitchen.order.reopen.${orderId}`, req, async () => {
            const items = await dbAsync.all(
                'SELECT id, status FROM order_items WHERE order_id = ? FOR UPDATE',
                [orderId]
            );

            if (!items.length) {
                throw createHttpError(404, 'No items found for this order');
            }

            // Reopen all served items back to pending
            const servedItems = items.filter(i => i.status === 'served' || i.status === 'ready');
            for (const item of servedItems) {
                await dbAsync.run('UPDATE order_items SET status = ? WHERE id = ?', ['pending', item.id]);
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'kitchen.order.reopened',
                entityType: 'order',
                entityId: orderId,
                oldValues: { itemsReopened: 0 },
                newValues: { itemsReopened: servedItems.length },
                metadata: getRequestMetadata(req),
            });

            return { status: 200, body: { orderId, itemsReopened: servedItems.length, message: 'Order reopened' } };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to reopen order', details: error.message });
    }
});

// ========================================================================
// THERMAL PRINTER API
// ========================================================================

// Get printer status
app.get('/api/printer/status', async (req, res) => {
    try {
        const status = await getPrinterStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get printer status', details: error.message });
    }
});

// Print receipt for an order
app.post('/api/print/receipt', async (req, res) => {
    try {
        const { orderId, businessName } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ error: 'Order ID required' });
        }
        
        // Get order details
        const order = await dbAsync.get(
            `SELECT o.*, t.name as table_name, u.username as server_name
             FROM orders o
             LEFT JOIN tables t ON t.id = o.table_id
             LEFT JOIN users u ON u.id = o.user_id
             WHERE o.id = ?`,
            [orderId]
        );
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Get order items
        const items = await dbAsync.all(
            `SELECT oi.*, p.name
             FROM order_items oi
             JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ? AND oi.voided_at IS NULL`,
            [orderId]
        );
        
        // Get payment info
        const payment = await dbAsync.get(
            `SELECT payment_method FROM payments WHERE order_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1`,
            [orderId]
        );
        
        // Format order for printing
        const printOrder = {
            id: order.id,
            tableName: order.table_name,
            serverName: order.server_name,
            items: items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                totalPriceCents: item.total_price_cents
            })),
            subtotalCents: order.subtotal_cents,
            taxAmountCents: order.tax_amount_cents,
            totalAmountCents: order.total_amount_cents,
            paymentMethod: payment?.payment_method
        };
        
        const result = await printReceipt(printOrder, businessName || 'Rio Chicken');
        res.json({ success: true, message: 'Receipt printed', bytesWritten: result.bytesWritten });
        
    } catch (error) {
        console.error('Print receipt error:', error);
        res.status(500).json({ error: 'Failed to print receipt', details: error.message });
    }
});

// Print daily report
app.post('/api/print/daily-report', async (req, res) => {
    try {
        const { startTime, endTime, businessName, currency } = req.body;
        
        // Default to today if no times provided
        const start = startTime ? new Date(startTime) : new Date(new Date().setHours(0, 0, 0, 0));
        const end = endTime ? new Date(endTime) : new Date();
        
        // Format dates for PostgreSQL
        const formatForDB = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };
        
        const startLocal = formatForDB(start);
        const endLocal = formatForDB(end);
        
        // Get orders summary
        const ordersSummary = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'paid' OR status = 'closed' THEN 1 END) as completed_orders,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN total_amount_cents ELSE 0 END), 0) as total_revenue_cents,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN subtotal_cents ELSE 0 END), 0) as subtotal_cents,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN tax_amount_cents ELSE 0 END), 0) as tax_cents
             FROM orders 
             WHERE created_at >= ? AND created_at <= ?`,
            [startLocal, endLocal]
        );
        
        // Get payments by method
        const paymentsByMethod = await dbAsync.all(
            `SELECT 
                payment_method,
                COUNT(*) as count,
                COALESCE(SUM(amount_cents), 0) as total_cents
             FROM payments 
             WHERE processed_at >= ? AND processed_at <= ? AND status = 'completed'
             GROUP BY payment_method`,
            [startLocal, endLocal]
        );
        
        // Get tables served count
        const tablesServed = await dbAsync.get(
            `SELECT COUNT(DISTINCT table_id) as total_tables
             FROM orders 
             WHERE created_at >= ? AND created_at <= ? 
               AND table_id IS NOT NULL 
               AND status IN ('paid', 'closed')`,
            [startLocal, endLocal]
        );
        
        // Get top selling items
        const topItems = await dbAsync.all(
            `SELECT 
                p.name,
                SUM(oi.quantity) as quantity_sold,
                SUM(oi.total_price_cents) as revenue_cents
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN products p ON p.id = oi.product_id
             WHERE o.created_at >= ? AND o.created_at <= ?
               AND o.status IN ('paid', 'closed')
               AND oi.voided_at IS NULL
             GROUP BY p.id, p.name
             ORDER BY quantity_sold DESC
             LIMIT 10`,
            [startLocal, endLocal]
        );
        
        // Format payments
        const payments = {};
        paymentsByMethod.forEach(p => {
            payments[p.payment_method] = {
                count: p.count,
                totalCents: Number(p.total_cents)
            };
        });
        
        // Build report data
        const reportData = {
            currency: currency || '$',
            period: { start: start.toISOString(), end: end.toISOString() },
            orders: {
                total: Number(ordersSummary.total_orders),
                completed: Number(ordersSummary.completed_orders),
                totalRevenueCents: Number(ordersSummary.total_revenue_cents),
                subtotalCents: Number(ordersSummary.subtotal_cents),
                taxCents: Number(ordersSummary.tax_cents)
            },
            payments,
            tablesServed: Number(tablesServed.total_tables),
            topItems: topItems.map(i => ({
                name: i.name,
                quantity: Number(i.quantity_sold),
                revenueCents: Number(i.revenue_cents)
            }))
        };
        
        const result = await printDailyReport(reportData, businessName || 'Rio Chicken');
        res.json({ success: true, message: 'Daily report printed', bytesWritten: result.bytesWritten });
        
    } catch (error) {
        console.error('Print daily report error:', error);
        res.status(500).json({ error: 'Failed to print daily report', details: error.message });
    }
});

// Print raw text (for testing)
app.post('/api/print/test', async (req, res) => {
    try {
        const { text } = req.body;
        const result = await printRawText(text || 'Test print from UniversalPOS');
        res.json({ success: true, message: 'Test printed', bytesWritten: result.bytesWritten });
    } catch (error) {
        res.status(500).json({ error: 'Failed to print', details: error.message });
    }
});

// ========================================================================
// DAILY REPORT & DAY END
// ========================================================================

// Get daily report data
app.get('/api/daily-report', async (req, res) => {
    try {
        const { startTime, endTime } = req.query;
        
        // Default to today if no times provided
        const start = startTime ? new Date(startTime) : new Date(new Date().setHours(0, 0, 0, 0));
        const end = endTime ? new Date(endTime) : new Date();
        
        // Format dates for PostgreSQL TIMESTAMP WITHOUT TIME ZONE comparison
        // The database stores local timestamps, so we need to format as local time strings
        const formatForDB = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };
        
        const startLocal = formatForDB(start);
        const endLocal = formatForDB(end);
        
        // Get orders summary
        const ordersSummary = await dbAsync.get(
            `SELECT 
                COUNT(*) as total_orders,
                COUNT(CASE WHEN status = 'paid' OR status = 'closed' THEN 1 END) as completed_orders,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN total_amount_cents ELSE 0 END), 0) as total_revenue_cents,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN subtotal_cents ELSE 0 END), 0) as subtotal_cents,
                COALESCE(SUM(CASE WHEN status IN ('paid', 'closed') THEN tax_amount_cents ELSE 0 END), 0) as tax_cents
             FROM orders 
             WHERE created_at >= ? AND created_at <= ?`,
            [startLocal, endLocal]
        );
        
        // Get payments by method
        const paymentsByMethod = await dbAsync.all(
            `SELECT 
                payment_method,
                COUNT(*) as count,
                COALESCE(SUM(amount_cents), 0) as total_cents
             FROM payments 
             WHERE processed_at >= ? AND processed_at <= ? AND status = 'completed'
             GROUP BY payment_method`,
            [startLocal, endLocal]
        );
        
        // Get tables served count
        const tablesServed = await dbAsync.get(
            `SELECT COUNT(DISTINCT table_id) as total_tables
             FROM orders 
             WHERE created_at >= ? AND created_at <= ? 
               AND table_id IS NOT NULL 
               AND status IN ('paid', 'closed')`,
            [startLocal, endLocal]
        );
        
        // Get top selling items
        const topItems = await dbAsync.all(
            `SELECT 
                p.name,
                SUM(oi.quantity) as quantity_sold,
                SUM(oi.total_price_cents) as revenue_cents
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             JOIN products p ON p.id = oi.product_id
             WHERE o.created_at >= ? AND o.created_at <= ?
               AND o.status IN ('paid', 'closed')
               AND oi.voided_at IS NULL
             GROUP BY p.id, p.name
             ORDER BY quantity_sold DESC
             LIMIT 10`,
            [startLocal, endLocal]
        );
        
        // Format payments by method
        const payments = {};
        paymentsByMethod.forEach(p => {
            payments[p.payment_method] = {
                count: p.count,
                totalCents: Number(p.total_cents)
            };
        });
        
        res.json({
            period: { start: start.toISOString(), end: end.toISOString() },
            orders: {
                total: Number(ordersSummary.total_orders),
                completed: Number(ordersSummary.completed_orders),
                totalRevenueCents: Number(ordersSummary.total_revenue_cents),
                subtotalCents: Number(ordersSummary.subtotal_cents),
                taxCents: Number(ordersSummary.tax_cents)
            },
            payments,
            tablesServed: Number(tablesServed.total_tables),
            topItems: topItems.map(i => ({
                name: i.name,
                quantity: Number(i.quantity_sold),
                revenueCents: Number(i.revenue_cents)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate daily report', details: error.message });
    }
});

// End day - archive completed orders and reset kitchen
app.post('/api/end-day', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const user = await getUserByUsername(userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const endTime = new Date();
        
        // Archive completed orders - mark them as archived
        const archiveResult = await dbAsync.run(
            `UPDATE orders SET 
                status = 'closed',
                closed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE status = 'paid' AND closed_at IS NULL`
        );
        
        // Reset all served items to clear kitchen display
        // This marks items from closed orders so they won't appear in kitchen queue
        const kitchenReset = await dbAsync.run(
            `UPDATE order_items SET status = 'archived'
             WHERE order_id IN (
                SELECT id FROM orders WHERE status = 'closed'
             ) AND status = 'served'`
        );
        
        // Log the day end
        const organizationId = await getDefaultOrgId();
        const locationId = await getDefaultLocationId();
        
        await logAuditEntry({
            organizationId,
            userId: user.id,
            locationId,
            action: 'pos.day_ended',
            entityType: 'system',
            entityId: locationId || 1, // Use location ID as entity for system-level events
            oldValues: null,
            newValues: { 
                endTime: endTime.toISOString(),
                ordersArchived: archiveResult.changes,
                kitchenItemsReset: kitchenReset.changes
            },
            metadata: { ended_by: userId }
        });
        
        res.json({
            success: true,
            message: 'Day ended successfully',
            ordersArchived: archiveResult.changes,
            kitchenItemsReset: kitchenReset.changes,
            endTime: endTime.toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to end day', details: error.message });
    }
});

// Catalog routes
app.get('/catalog', async (req, res) => {
    try {
        const rows = await dbAsync.all(
            `SELECT p.id, p.name, p.description, p.base_price as price, c.name as category
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = 1
             ORDER BY p.id`
        );

        const products = rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            price: Number(row.price),
            category: row.category ? row.category.toLowerCase() : 'other',
        }));

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load products', details: error.message });
    }
});

// Order routes
app.post('/orders', async (req, res) => {
    try {
        const { userId, items, orderId, tableId } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Order items are required' });
            return;
        }

        const action = orderId ? `orders.add_items.${orderId}` : 'orders.create';
        const result = await runTransactionalAction(action, req, async () => {
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);

            const subtotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
            const taxAmount = 0;
            const totalAmount = subtotal + taxAmount;

            if (orderId) {
                const existingOrder = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [orderId]);
                if (!existingOrder) {
                    throw createHttpError(404, 'Order not found');
                }
                if (['paid', 'closed', 'voided'].includes(existingOrder.status)) {
                    throw createHttpError(409, 'Cannot modify a closed order.');
                }

                for (const item of items) {
                    const unitPriceCents = dollarsToCents(Number(item.unitPrice || 0));
                    const totalPriceCents = dollarsToCents(Number(item.totalPrice || 0));
                    await dbAsync.run(
                        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, unit_price_cents, total_price_cents, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                        [
                            orderId,
                            item.productId ? Number(item.productId) : null,
                            Number(item.quantity || 1),
                            Number(item.unitPrice || 0),
                            Number(item.totalPrice || 0),
                            unitPriceCents,
                            totalPriceCents,
                        ]
                    );
                }

                const newSubtotal = Number(existingOrder.subtotal || 0) + subtotal;
                const newTax = Number(existingOrder.tax_amount || 0) + taxAmount;
                const newTotal = Number(existingOrder.total_amount || 0) + totalAmount;
                
                // Also update cents columns
                const newSubtotalCents = dollarsToCents(newSubtotal);
                const newTaxCents = dollarsToCents(newTax);
                const newTotalCents = dollarsToCents(newTotal);

                await dbAsync.run(
                    `UPDATE orders SET subtotal = ?, tax_amount = ?, total_amount = ?, 
                     subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [newSubtotal, newTax, newTotal, newSubtotalCents, newTaxCents, newTotalCents, orderId]
                );

                if (tableId && !existingOrder.table_id) {
                    const latestTableStatus = await getLatestTableStatus(tableId);
                    if (latestTableStatus && !['available', 'reserved'].includes(latestTableStatus.status)) {
                        throw createHttpError(409, 'Table is not available for assignment.');
                    }
                    await dbAsync.run('UPDATE orders SET table_id = ? WHERE id = ?', [tableId, orderId]);
                    await dbAsync.run(
                        'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                        [tableId, 'seated', orderId, userDbId, 'Order assigned to table']
                    );
                    await logAuditEntry({
                        organizationId,
                        userId: userDbId,
                        locationId,
                        action: 'table.seated',
                        entityType: 'table',
                        entityId: tableId,
                        oldValues: latestTableStatus || null,
                        newValues: { status: 'seated', order_id: orderId },
                        metadata: getRequestMetadata(req),
                    });
                }

                await logAuditEntry({
                    organizationId,
                    userId: userDbId,
                    locationId,
                    action: 'order.updated',
                    entityType: 'order',
                    entityId: orderId,
                    oldValues: {
                        subtotal: existingOrder.subtotal,
                        tax_amount: existingOrder.tax_amount,
                        total_amount: existingOrder.total_amount,
                    },
                    newValues: {
                        subtotal: newSubtotal,
                        tax_amount: newTax,
                        total_amount: newTotal,
                    },
                    metadata: getRequestMetadata(req),
                });

                return {
                    status: 200,
                    body: {
                        id: orderId,
                        orderNumber: existingOrder.order_number,
                        items,
                        totalAmount: newTotal,
                        taxAmount: newTax,
                        status: existingOrder.status,
                    },
                };
            }

            const latestTableStatus = tableId ? await getLatestTableStatus(tableId) : null;
            if (tableId && latestTableStatus && !['available', 'reserved'].includes(latestTableStatus.status)) {
                throw createHttpError(409, 'Table is not available for seating.');
            }

            const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            
            // Convert dollars to cents for money safety
            const subtotalCents = dollarsToCents(subtotal);
            const taxAmountCents = dollarsToCents(taxAmount);
            const totalAmountCents = dollarsToCents(totalAmount);
            
            const orderResult = await dbAsync.run(
                `INSERT INTO orders (
                    organization_id,
                    location_id,
                    user_id,
                    table_id,
                    order_number,
                    status,
                    order_type,
                    subtotal,
                    tax_amount,
                    total_amount,
                    subtotal_cents,
                    tax_amount_cents,
                    total_amount_cents
                ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
                [
                    organizationId,
                    locationId,
                    userDbId,
                    tableId || null,
                    orderNumber,
                    tableId ? 'dine_in' : 'takeout',
                    subtotal,
                    taxAmount,
                    totalAmount,
                    subtotalCents,
                    taxAmountCents,
                    totalAmountCents,
                ]
            );

            const createdOrderId = orderResult.lastID;

            for (const item of items) {
                const unitPriceCents = dollarsToCents(Number(item.unitPrice || 0));
                const totalPriceCents = dollarsToCents(Number(item.totalPrice || 0));
                await dbAsync.run(
                    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price, unit_price_cents, total_price_cents, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
                    [
                        createdOrderId,
                        item.productId ? Number(item.productId) : null,
                        Number(item.quantity || 1),
                        Number(item.unitPrice || 0),
                        Number(item.totalPrice || 0),
                        unitPriceCents,
                        totalPriceCents,
                    ]
                );
            }

            if (tableId) {
                await dbAsync.run(
                    'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                    [tableId, 'seated', createdOrderId, userDbId, 'Order started']
                );
                await logAuditEntry({
                    organizationId,
                    userId: userDbId,
                    locationId,
                    action: 'table.seated',
                    entityType: 'table',
                    entityId: tableId,
                    oldValues: latestTableStatus || null,
                    newValues: { status: 'seated', order_id: createdOrderId },
                    metadata: getRequestMetadata(req),
                });
            }

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'order.created',
                entityType: 'order',
                entityId: createdOrderId,
                oldValues: null,
                newValues: {
                    order_number: orderNumber,
                    table_id: tableId || null,
                    subtotal,
                    tax_amount: taxAmount,
                    total_amount: totalAmount,
                },
                metadata: getRequestMetadata(req),
            });

            return {
                status: 201,
                body: {
                    id: createdOrderId,
                    orderNumber,
                    items,
                    totalAmount,
                    taxAmount,
                    status: 'open',
                },
            };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to create order', details: error.message });
    }
});

app.get('/orders/:id', async (req, res) => {
    try {
        const order = await dbAsync.get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
        if (!order) {
            res.status(404).json({ error: 'Order not found' });
            return;
        }

        const rawItems = await dbAsync.all(
            `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.total_price, oi.status, oi.notes,
                    oi.voided_at, oi.is_comped,
                    p.name as product_name,
                    da.id as discount_id, da.discount_type, da.discount_value, 
                    da.discount_amount_cents, da.original_amount_cents
             FROM order_items oi
             LEFT JOIN products p ON p.id = oi.product_id
             LEFT JOIN discount_applications da ON da.order_item_id = oi.id
             WHERE oi.order_id = ?`,
            [req.params.id]
        );
        
        // Transform to camelCase for frontend compatibility
        const items = rawItems.map(item => ({
            id: item.id,
            productId: item.product_id,
            name: item.product_name || 'Unknown Product',
            quantity: item.quantity,
            unitPrice: Number(item.unit_price),
            totalPrice: Number(item.total_price),
            status: item.status || 'pending',
            notes: item.notes || '',
            sentToKitchen: ['pending', 'preparing', 'ready', 'served'].includes(item.status),
            voided: !!item.voided_at,
            isComped: !!item.is_comped,
            // Discount info
            hasDiscount: !!item.discount_id,
            discountId: item.discount_id || null,
            discountType: item.discount_type || null,
            discountValue: item.discount_value ? Number(item.discount_value) : null,
            discountAmountCents: item.discount_amount_cents || null,
            originalAmountCents: item.original_amount_cents || null
        }));

        res.json({ ...order, items });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load order', details: error.message });
    }
});

// Bill generation - creates a bill from an order
// HARDENED: Server computes totals, uses integer cents, FOR UPDATE locking
app.post('/orders/:id/bill', async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { userId, customerId } = req.body;

        const result = await runTransactionalAction(`orders.bill.${orderId}`, req, async () => {
            // CONCURRENCY SAFETY: Lock the order row to prevent concurrent billing
            const order = await dbAsync.get(
                'SELECT * FROM orders WHERE id = ? FOR UPDATE',
                [orderId]
            );
            if (!order) {
                throw createHttpError(404, 'Order not found');
            }

            // If customerId provided, link customer to order
            if (customerId) {
                await dbAsync.run(
                    'UPDATE orders SET customer_id = ? WHERE id = ?',
                    [customerId, orderId]
                );
                order.customer_id = customerId;
            }

            // Guard: Cannot bill already billed/paid/closed orders
            if (['billed', 'paid', 'closed', 'voided'].includes(order.status)) {
                throw createHttpError(409, `Order is already ${order.status}`);
            }

            // Guard: Cannot bill order with no non-voided items sent to kitchen
            const sentItems = await dbAsync.get(
                `SELECT COUNT(*) as count FROM order_items 
                 WHERE order_id = ? AND status IN ('pending', 'preparing', 'ready', 'served') AND voided_at IS NULL`,
                [orderId]
            );
            if (!sentItems || sentItems.count === 0) {
                throw createHttpError(409, 'Cannot bill order without items sent to kitchen');
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);

            // MONEY SAFETY: Server computes totals using integer cents
            // Handle both old data (only total_price) and new data (total_price_cents)
            // IMPORTANT: Exclude voided items from bill total
            const totals = await dbAsync.get(
                `SELECT 
                    SUM(COALESCE(total_price_cents, ROUND(total_price * 100))) as subtotal_cents
                 FROM order_items WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            const taxRateBps = 0; // No tax
            const taxAmountCents = calculateTaxCents(subtotalCents, taxRateBps);
            const totalAmountCents = subtotalCents + taxAmountCents;

            // For backward compatibility, also update DECIMAL columns
            const subtotal = centsToDollars(subtotalCents);
            const taxAmount = centsToDollars(taxAmountCents);
            const totalAmount = centsToDollars(totalAmountCents);

            // Update order status and totals (both cents and dollars)
            await dbAsync.run(
                `UPDATE orders SET 
                    status = 'billed', 
                    subtotal = ?, 
                    tax_amount = ?, 
                    total_amount = ?,
                    subtotal_cents = ?,
                    tax_amount_cents = ?,
                    total_amount_cents = ?,
                    updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [subtotal, taxAmount, totalAmount, subtotalCents, taxAmountCents, totalAmountCents, orderId]
            );

            // Update table status to 'billed'
            if (order.table_id) {
                // AUDIT-SAFE HISTORY: Close out seated row instead of deleting
                // This preserves full audit trail while allowing the unique index to work
                await dbAsync.run(
                    `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                     WHERE table_id = ? AND status = 'seated' AND ended_at IS NULL`,
                    [order.table_id]
                );
                
                await dbAsync.run(
                    'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                    [order.table_id, 'billed', orderId, userDbId, 'Bill generated']
                );

                await logAuditEntry({
                    organizationId,
                    userId: userDbId,
                    locationId,
                    action: 'table.billed',
                    entityType: 'table',
                    entityId: order.table_id,
                    oldValues: { status: 'seated' },
                    newValues: { status: 'billed', order_id: orderId },
                    metadata: getRequestMetadata(req),
                });
            }

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'order.billed',
                entityType: 'order',
                entityId: orderId,
                oldValues: { status: order.status },
                newValues: { 
                    status: 'billed', 
                    subtotal_cents: subtotalCents,
                    tax_amount_cents: taxAmountCents,
                    total_amount_cents: totalAmountCents,
                },
                metadata: getRequestMetadata(req),
            });

            // Get items for bill display - handle both old and new data
            const items = await dbAsync.all(
                `SELECT oi.id, oi.quantity, 
                        COALESCE(oi.unit_price_cents, ROUND(oi.unit_price * 100)) as unit_price_cents,
                        COALESCE(oi.total_price_cents, ROUND(oi.total_price * 100)) as total_price_cents, 
                        p.name as product_name
                 FROM order_items oi
                 LEFT JOIN products p ON p.id = oi.product_id
                 WHERE oi.order_id = ?`,
                [orderId]
            );

            // Get loyalty customer info if linked
            let loyaltyCustomer = null;
            if (order.customer_id) {
                const customer = await dbAsync.get(
                    `SELECT c.id, c.first_name, c.last_name, c.phone, c.email,
                            la.current_points
                     FROM customers c
                     LEFT JOIN loyalty_accounts la ON la.customer_id = c.id AND la.is_active = true
                     WHERE c.id = ?`,
                    [order.customer_id]
                );
                if (customer) {
                    loyaltyCustomer = {
                        id: customer.id,
                        name: `${customer.first_name} ${customer.last_name}`,
                        firstName: customer.first_name,
                        lastName: customer.last_name,
                        phone: customer.phone,
                        email: customer.email,
                        points: customer.current_points || 0
                    };
                }
            }

            return {
                status: 200,
                body: {
                    orderId,
                    orderNumber: order.order_number,
                    status: 'billed',
                    loyaltyCustomer,
                    // Return both cents (canonical) and dollars (for display)
                    subtotalCents,
                    taxAmountCents,
                    totalAmountCents,
                    subtotal,
                    taxAmount,
                    totalAmount,
                    items: items.map(item => ({
                        id: item.id,
                        name: item.product_name,
                        quantity: item.quantity,
                        unitPriceCents: Number(item.unit_price_cents),
                        totalPriceCents: Number(item.total_price_cents),
                        // For display
                        unitPrice: centsToDollars(item.unit_price_cents),
                        totalPrice: centsToDollars(item.total_price_cents),
                    })),
                },
            };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to generate bill', details: error.message });
    }
});

// Close order after payment - sets table to needs_cleaning
app.post('/orders/:id/close', async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { userId } = req.body;

        const result = await runTransactionalAction(`orders.close.${orderId}`, req, async () => {
            // CONCURRENCY SAFETY: Lock the order row to prevent concurrent close
            const order = await dbAsync.get('SELECT * FROM orders WHERE id = ? FOR UPDATE', [orderId]);
            if (!order) {
                throw createHttpError(404, 'Order not found');
            }

            // Guard: Can only close paid orders
            if (order.status !== 'paid') {
                throw createHttpError(409, `Cannot close order with status '${order.status}'. Order must be paid first.`);
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            const userDbId = await getUserIdFromUsername(userId);

            // Update order status to closed
            await dbAsync.run(
                `UPDATE orders SET 
                    status = 'closed', 
                    closed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [orderId]
            );

            // AUDIT-SAFE HISTORY: Close out billed row before inserting needs_cleaning
            if (order.table_id) {
                await dbAsync.run(
                    `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
                     WHERE table_id = ? AND status = 'billed' AND ended_at IS NULL`,
                    [order.table_id]
                );
            }

            // Update table status to 'needs_cleaning'
            if (order.table_id) {
                await dbAsync.run(
                    'INSERT INTO table_statuses (table_id, status, order_id, user_id, notes) VALUES (?, ?, ?, ?, ?)',
                    [order.table_id, 'needs_cleaning', null, userDbId, 'Order closed, table needs cleaning']
                );

                await logAuditEntry({
                    organizationId,
                    userId: userDbId,
                    locationId,
                    action: 'table.needs_cleaning',
                    entityType: 'table',
                    entityId: order.table_id,
                    oldValues: { status: 'billed', order_id: orderId },
                    newValues: { status: 'needs_cleaning' },
                    metadata: getRequestMetadata(req),
                });
            }

            await logAuditEntry({
                organizationId,
                userId: userDbId,
                locationId,
                action: 'order.closed',
                entityType: 'order',
                entityId: orderId,
                oldValues: { status: order.status },
                newValues: { status: 'closed' },
                metadata: getRequestMetadata(req),
            });

            return {
                status: 200,
                body: {
                    orderId,
                    status: 'closed',
                    tableId: order.table_id,
                    tableStatus: order.table_id ? 'needs_cleaning' : null,
                },
            };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to close order', details: error.message });
    }
});

// Payment routes
// HARDENED: Server fetches amount from order (not client), FOR UPDATE locking, unique constraint prevents double-pay
app.post('/payments', async (req, res) => {
    try {
        const { orderId, method, amountCents: clientAmountCents } = req.body;
        // Note: We intentionally IGNORE client-sent amount - server will compute from order
        // But if client DOES send an amount, we verify it matches to catch bugs early
        if (!orderId || !method) {
            res.status(400).json({ error: 'Order ID and payment method are required' });
            return;
        }

        const result = await runTransactionalAction(`payments.process.${orderId}`, req, async () => {
            // CONCURRENCY SAFETY: Lock the order row to prevent concurrent payment
            const order = await dbAsync.get(
                'SELECT id, status, table_id, total_amount_cents FROM orders WHERE id = ? FOR UPDATE',
                [orderId]
            );
            if (!order) {
                throw createHttpError(404, 'Order not found');
            }
            if (['paid', 'closed'].includes(order.status)) {
                throw createHttpError(409, 'Order is already paid.');
            }

            // Per blueprint: payment requires order to be billed first
            if (order.status !== 'billed') {
                throw createHttpError(409, 'Order must be billed before payment. Generate bill first.');
            }

            // MONEY SAFETY: Server uses the amount from the order, NOT from the client
            const amountCents = order.total_amount_cents;
            if (!amountCents || amountCents <= 0) {
                throw createHttpError(409, 'Order has no billable amount. Generate bill first.');
            }

            // MONEY SAFETY GUARD: If client sends an amount, verify it matches server total
            // This catches client-side calculation bugs early
            if (clientAmountCents !== undefined && clientAmountCents !== null) {
                if (Number(clientAmountCents) !== amountCents) {
                    throw createHttpError(409, 
                        `Amount mismatch: client sent ${clientAmountCents}¢ but server total is ${amountCents}¢. ` +
                        `This likely indicates a client-side calculation bug.`
                    );
                }
            }

            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            // CONCURRENCY SAFETY: The unique index idx_order_unique_completed_payment
            // will cause this INSERT to fail if a payment already exists for this order
            const payment = await dbAsync.run(
                `INSERT INTO payments (order_id, amount, amount_cents, payment_method, status)
                 VALUES (?, ?, ?, ?, 'completed')`,
                [orderId, centsToDollars(amountCents), amountCents, method]
            );

            await dbAsync.run(
                `UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [orderId]
            );

            // Note: Table status transitions to needs_cleaning via /orders/:id/close
            // We don't change table status here - order is paid but table still shows 'billed'
            // until staff explicitly closes the order

            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'payment.processed',
                entityType: 'payment',
                entityId: payment.lastID,
                oldValues: null,
                newValues: { 
                    order_id: orderId, 
                    amount_cents: amountCents, 
                    method, 
                    status: 'completed' 
                },
                metadata: getRequestMetadata(req),
            });

            await logAuditEntry({
                organizationId,
                userId: null,
                locationId,
                action: 'order.paid',
                entityType: 'order',
                entityId: orderId,
                oldValues: { status: order.status },
                newValues: { status: 'paid' },
                metadata: getRequestMetadata(req),
            });

            return {
                status: 200,
                body: {
                    id: payment.lastID,
                    orderId,
                    amountCents,
                    amount: centsToDollars(amountCents),
                    method,
                    status: 'completed',
                },
            };
        });

        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        // Check for unique constraint violation (double-pay attempt)
        if (error.message && error.message.includes('idx_order_unique_completed_payment')) {
            res.status(409).json({ error: 'Payment already exists for this order' });
            return;
        }
        res.status(500).json({ error: 'Payment failed', details: error.message });
    }
});

// ============================================================================
// PHASE 1: ORDER OPERATIONS (VOID / DISCOUNT / COMP)
// ============================================================================

// Get void reasons (for UI dropdown)
app.get('/config/void-reasons', async (req, res) => {
    try {
        const reasons = await dbAsync.all(
            `SELECT id, code, description, requires_manager as "requiresManager"
             FROM void_reasons WHERE is_active = true ORDER BY description`
        );
        res.json(reasons);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load void reasons', details: error.message });
    }
});

// Get discount types (for UI dropdown)
app.get('/config/discount-types', async (req, res) => {
    try {
        const types = await dbAsync.all(
            `SELECT id, code, name, type, value, 
                    max_value_cents as "maxValueCents",
                    requires_manager as "requiresManager"
             FROM discount_types WHERE is_active = true ORDER BY name`
        );
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load discount types', details: error.message });
    }
});

// Get current user permissions
app.get('/users/me/permissions', async (req, res) => {
    try {
        const username = req.headers['x-user-id'] || req.query.userId;
        if (!username) {
            return res.status(400).json({ error: 'User ID required (x-user-id header or userId query param)' });
        }
        
        const user = await getUserByUsername(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Build effective permissions
        const allPermissions = ['void_item', 'discount_item', 'comp_item', 'order_discount', 'manager_override', 'view_reports', 'manage_users'];
        const effectivePermissions = {};
        
        for (const perm of allPermissions) {
            effectivePermissions[perm] = userHasPermission(user, perm);
        }
        
        res.json({
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: effectivePermissions
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get permissions', details: error.message });
    }
});

// VOID ITEM - Soft delete with full audit trail
app.post('/orders/:orderId/items/:itemId/void', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const itemId = Number(req.params.itemId);
        const { userId, reasonId, reasonText } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const result = await runTransactionalAction(`orders.void_item.${itemId}`, req, async () => {
            // Get user with permissions
            const user = await getUserByUsername(userId);
            if (!user) {
                throw createHttpError(401, 'User not found');
            }
            
            // Lock the order item for update
            const item = await dbAsync.get(
                `SELECT oi.*, o.status as order_status 
                 FROM order_items oi 
                 JOIN orders o ON o.id = oi.order_id
                 WHERE oi.id = ? AND oi.order_id = ? 
                 FOR UPDATE`,
                [itemId, orderId]
            );
            
            if (!item) {
                throw createHttpError(404, 'Order item not found');
            }
            
            if (item.voided_at) {
                throw createHttpError(409, 'Item is already voided');
            }
            
            // Cannot void items on paid/closed orders
            if (['paid', 'closed', 'voided'].includes(item.order_status)) {
                throw createHttpError(409, `Cannot void item on ${item.order_status} order`);
            }
            
            // Check void reason - some require manager
            let voidReason = null;
            if (reasonId) {
                voidReason = await dbAsync.get(
                    'SELECT * FROM void_reasons WHERE id = ? AND is_active = true',
                    [reasonId]
                );
                if (!voidReason) {
                    throw createHttpError(400, 'Invalid void reason');
                }
                
                if (voidReason.requires_manager && !userHasPermission(user, 'manager_override')) {
                    throw createHttpError(403, 'This void reason requires manager approval');
                }
            }
            
            // Check basic void permission
            if (!userHasPermission(user, 'void_item')) {
                throw createHttpError(403, 'Permission denied: void_item required');
            }
            
            // Perform the void (soft delete)
            await dbAsync.run(
                `UPDATE order_items SET 
                    voided_at = CURRENT_TIMESTAMP,
                    voided_by = ?,
                    void_reason_id = ?,
                    void_reason_text = ?,
                    status = 'voided'
                 WHERE id = ?`,
                [user.id, reasonId || null, reasonText || null, itemId]
            );
            
            // Recalculate order totals excluding voided items
            const totals = await dbAsync.get(
                `SELECT 
                    COALESCE(SUM(COALESCE(total_price_cents, ROUND(total_price * 100))), 0) as subtotal_cents
                 FROM order_items 
                 WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            const taxAmountCents = calculateTaxCents(subtotalCents, 1000);
            const totalAmountCents = subtotalCents + taxAmountCents;
            
            await dbAsync.run(
                `UPDATE orders SET 
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [subtotalCents, taxAmountCents, totalAmountCents,
                 centsToDollars(subtotalCents), centsToDollars(taxAmountCents), centsToDollars(totalAmountCents),
                 orderId]
            );
            
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            await logAuditEntry({
                organizationId,
                userId: user.id,
                locationId,
                action: 'order_item.voided',
                entityType: 'order_item',
                entityId: itemId,
                oldValues: {
                    status: item.status,
                    total_price_cents: item.total_price_cents || Math.round(item.total_price * 100)
                },
                newValues: {
                    status: 'voided',
                    void_reason: voidReason?.code || 'custom',
                    void_reason_text: reasonText || null
                },
                metadata: { ...getRequestMetadata(req), voided_by_username: userId }
            });
            
            return {
                status: 200,
                body: {
                    itemId,
                    orderId,
                    status: 'voided',
                    voidReason: voidReason?.code || 'custom',
                    voidReasonText: reasonText || null,
                    newOrderTotalCents: totalAmountCents,
                    newOrderTotal: centsToDollars(totalAmountCents)
                }
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to void item', details: error.message });
    }
});

// DISCOUNT ITEM - Apply percentage or fixed discount to an item
app.post('/orders/:orderId/items/:itemId/discount', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const itemId = Number(req.params.itemId);
        const { userId, discountTypeId, discountType, discountValue, reason } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        if (!discountTypeId && (!discountType || discountValue === undefined)) {
            return res.status(400).json({ error: 'Either discountTypeId or (discountType + discountValue) required' });
        }
        
        const result = await runTransactionalAction(`orders.discount_item.${itemId}`, req, async () => {
            const user = await getUserByUsername(userId);
            if (!user) {
                throw createHttpError(401, 'User not found');
            }
            
            if (!userHasPermission(user, 'discount_item')) {
                throw createHttpError(403, 'Permission denied: discount_item required');
            }
            
            // Lock the order item
            const item = await dbAsync.get(
                `SELECT oi.*, o.status as order_status 
                 FROM order_items oi 
                 JOIN orders o ON o.id = oi.order_id
                 WHERE oi.id = ? AND oi.order_id = ? 
                 FOR UPDATE`,
                [itemId, orderId]
            );
            
            if (!item) {
                throw createHttpError(404, 'Order item not found');
            }
            
            if (item.voided_at) {
                throw createHttpError(409, 'Cannot discount a voided item');
            }
            
            if (['paid', 'closed', 'voided'].includes(item.order_status)) {
                throw createHttpError(409, `Cannot discount item on ${item.order_status} order`);
            }
            
            // Check if item already has a discount
            const existingDiscount = await dbAsync.get(
                'SELECT id FROM discount_applications WHERE order_item_id = ?',
                [itemId]
            );
            if (existingDiscount) {
                throw createHttpError(409, 'Item already has a discount applied');
            }
            
            // Resolve discount type
            let resolvedType = discountType;
            let resolvedValue = Number(discountValue || 0);
            let discountTypeRecord = null;
            
            if (discountTypeId) {
                discountTypeRecord = await dbAsync.get(
                    'SELECT * FROM discount_types WHERE id = ? AND is_active = true',
                    [discountTypeId]
                );
                if (!discountTypeRecord) {
                    throw createHttpError(400, 'Invalid discount type');
                }
                resolvedType = discountTypeRecord.type;
                resolvedValue = Number(discountTypeRecord.value);
                
                if (discountTypeRecord.requires_manager && !userHasPermission(user, 'manager_override')) {
                    throw createHttpError(403, 'This discount type requires manager approval');
                }
            }
            
            // Calculate discount amount
            const originalAmountCents = item.total_price_cents || Math.round(item.total_price * 100);
            let discountAmountCents;
            
            if (resolvedType === 'percentage') {
                discountAmountCents = Math.round((originalAmountCents * resolvedValue) / 100);
                // Cap at max if specified
                if (discountTypeRecord?.max_value_cents && discountAmountCents > discountTypeRecord.max_value_cents) {
                    discountAmountCents = discountTypeRecord.max_value_cents;
                }
            } else { // fixed_amount
                discountAmountCents = Math.round(resolvedValue * 100);
            }
            
            // Cannot discount more than item price
            if (discountAmountCents > originalAmountCents) {
                discountAmountCents = originalAmountCents;
            }
            
            // Create discount application record
            await dbAsync.run(
                `INSERT INTO discount_applications (
                    order_id, order_item_id, discount_type_id, discount_type, discount_value,
                    discount_amount_cents, original_amount_cents, reason, applied_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderId, itemId, discountTypeId || null, resolvedType, resolvedValue,
                 discountAmountCents, originalAmountCents, reason || null, user.id]
            );
            
            // Update the order item's price
            const newTotalPriceCents = originalAmountCents - discountAmountCents;
            await dbAsync.run(
                `UPDATE order_items SET 
                    total_price_cents = ?, total_price = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [newTotalPriceCents, centsToDollars(newTotalPriceCents), itemId]
            );
            
            // Recalculate order totals
            const totals = await dbAsync.get(
                `SELECT 
                    COALESCE(SUM(total_price_cents), 0) as subtotal_cents
                 FROM order_items 
                 WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            const taxAmountCents = calculateTaxCents(subtotalCents, 1000);
            const totalAmountCents = subtotalCents + taxAmountCents;
            
            await dbAsync.run(
                `UPDATE orders SET 
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [subtotalCents, taxAmountCents, totalAmountCents,
                 centsToDollars(subtotalCents), centsToDollars(taxAmountCents), centsToDollars(totalAmountCents),
                 orderId]
            );
            
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            await logAuditEntry({
                organizationId,
                userId: user.id,
                locationId,
                action: 'order_item.discounted',
                entityType: 'order_item',
                entityId: itemId,
                oldValues: { total_price_cents: originalAmountCents },
                newValues: { 
                    total_price_cents: newTotalPriceCents,
                    discount_amount_cents: discountAmountCents,
                    discount_type: resolvedType,
                    discount_value: resolvedValue
                },
                metadata: { ...getRequestMetadata(req), applied_by_username: userId }
            });
            
            return {
                status: 200,
                body: {
                    itemId,
                    orderId,
                    discountType: resolvedType,
                    discountValue: resolvedValue,
                    discountAmountCents,
                    originalAmountCents,
                    newAmountCents: newTotalPriceCents,
                    newOrderTotalCents: totalAmountCents
                }
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to apply discount', details: error.message });
    }
});

// REMOVE DISCOUNT - Remove an existing discount from an item
app.delete('/orders/:orderId/items/:itemId/discount', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const itemId = Number(req.params.itemId);
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        const result = await runTransactionalAction(`orders.remove_discount.${itemId}`, req, async () => {
            const user = await getUserByUsername(userId);
            if (!user) {
                throw createHttpError(401, 'User not found');
            }
            
            if (!userHasPermission(user, 'discount_item')) {
                throw createHttpError(403, 'Permission denied: discount_item required');
            }
            
            // Get the discount application
            const discount = await dbAsync.get(
                `SELECT da.*, oi.order_id 
                 FROM discount_applications da
                 JOIN order_items oi ON oi.id = da.order_item_id
                 WHERE da.order_item_id = ? AND oi.order_id = ?`,
                [itemId, orderId]
            );
            
            if (!discount) {
                throw createHttpError(404, 'No discount found for this item');
            }
            
            // Check order status
            const order = await dbAsync.get(
                'SELECT status FROM orders WHERE id = ? FOR UPDATE',
                [orderId]
            );
            
            if (['paid', 'closed', 'voided'].includes(order.status)) {
                throw createHttpError(409, `Cannot remove discount from ${order.status} order`);
            }
            
            // Restore original price
            const restoredPriceCents = discount.original_amount_cents;
            await dbAsync.run(
                `UPDATE order_items SET 
                    total_price_cents = ?, total_price = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [restoredPriceCents, centsToDollars(restoredPriceCents), itemId]
            );
            
            // Delete the discount application
            await dbAsync.run('DELETE FROM discount_applications WHERE id = ?', [discount.id]);
            
            // Recalculate order totals
            const totals = await dbAsync.get(
                `SELECT COALESCE(SUM(total_price_cents), 0) as subtotal_cents
                 FROM order_items 
                 WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            const taxAmountCents = calculateTaxCents(subtotalCents, 1000);
            const totalAmountCents = subtotalCents + taxAmountCents;
            
            await dbAsync.run(
                `UPDATE orders SET 
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [subtotalCents, taxAmountCents, totalAmountCents,
                 centsToDollars(subtotalCents), centsToDollars(taxAmountCents), centsToDollars(totalAmountCents),
                 orderId]
            );
            
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            await logAuditEntry({
                organizationId,
                userId: user.id,
                locationId,
                action: 'order_item.discount_removed',
                entityType: 'order_item',
                entityId: itemId,
                oldValues: { 
                    total_price_cents: discount.original_amount_cents - discount.discount_amount_cents,
                    discount_type: discount.discount_type,
                    discount_value: discount.discount_value
                },
                newValues: { total_price_cents: restoredPriceCents },
                metadata: { ...getRequestMetadata(req), removed_by_username: userId }
            });
            
            return {
                status: 200,
                body: {
                    itemId,
                    orderId,
                    restoredAmountCents: restoredPriceCents,
                    newOrderTotalCents: totalAmountCents,
                    message: 'Discount removed successfully'
                }
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to remove discount', details: error.message });
    }
});

// COMP ITEM - Full or partial comp (manager only)
app.post('/orders/:orderId/items/:itemId/comp', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const itemId = Number(req.params.itemId);
        const { userId, reason, compQuantity } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        if (!reason) {
            return res.status(400).json({ error: 'Comp reason is required' });
        }
        
        const result = await runTransactionalAction(`orders.comp_item.${itemId}`, req, async () => {
            const user = await getUserByUsername(userId);
            if (!user) {
                throw createHttpError(401, 'User not found');
            }
            
            // Comp requires manager permission
            if (!userHasPermission(user, 'comp_item')) {
                throw createHttpError(403, 'Permission denied: comp_item requires manager or admin role');
            }
            
            // Lock the order item
            const item = await dbAsync.get(
                `SELECT oi.*, o.status as order_status 
                 FROM order_items oi 
                 JOIN orders o ON o.id = oi.order_id
                 WHERE oi.id = ? AND oi.order_id = ? 
                 FOR UPDATE`,
                [itemId, orderId]
            );
            
            if (!item) {
                throw createHttpError(404, 'Order item not found');
            }
            
            if (item.voided_at) {
                throw createHttpError(409, 'Cannot comp a voided item');
            }
            
            if (item.is_comped) {
                throw createHttpError(409, 'Item is already comped');
            }
            
            if (['paid', 'closed', 'voided'].includes(item.order_status)) {
                throw createHttpError(409, `Cannot comp item on ${item.order_status} order`);
            }
            
            const originalQuantity = item.quantity;
            const qtyToComp = compQuantity && compQuantity > 0 ? Math.min(compQuantity, originalQuantity) : originalQuantity;
            const isPartialComp = qtyToComp < originalQuantity;
            
            const unitPriceCents = item.unit_price_cents || Math.round(item.unit_price * 100);
            const originalAmountCents = item.total_price_cents || Math.round(item.total_price * 100);
            const compAmountCents = unitPriceCents * qtyToComp;
            
            let newCompedItemId = null;
            let remainingQuantity = originalQuantity - qtyToComp;
            let remainingAmountCents = unitPriceCents * remainingQuantity;
            
            if (isPartialComp) {
                // PARTIAL COMP: Split the item
                // 1. Reduce quantity on original item
                await dbAsync.run(
                    `UPDATE order_items SET 
                        quantity = ?,
                        total_price_cents = ?,
                        total_price = ?,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [remainingQuantity, remainingAmountCents, centsToDollars(remainingAmountCents), itemId]
                );
                
                // 2. Create new item row for the comped quantity
                const insertResult = await dbAsync.run(
                    `INSERT INTO order_items (
                        order_id, product_id, quantity, unit_price, total_price,
                        unit_price_cents, total_price_cents,
                        status, notes, kitchen_station_id,
                        is_comped, comped_at, comped_by, comp_reason, comp_approved_by,
                        created_at
                    ) VALUES (?, ?, ?, ?, 0, ?, 0, ?, ?, ?, true, CURRENT_TIMESTAMP, ?, ?, ?, CURRENT_TIMESTAMP)`,
                    [
                        orderId, item.product_id, qtyToComp, item.unit_price, unitPriceCents,
                        item.status || 'pending', item.notes || null, item.kitchen_station_id || null,
                        user.id, reason, user.id
                    ]
                );
                newCompedItemId = insertResult.lastID;
            } else {
                // FULL COMP: Mark entire item as comped
                await dbAsync.run(
                    `UPDATE order_items SET 
                        is_comped = true,
                        comped_at = CURRENT_TIMESTAMP,
                        comped_by = ?,
                        comp_reason = ?,
                        comp_approved_by = ?,
                        total_price_cents = 0,
                        total_price = 0,
                        updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [user.id, reason, user.id, itemId]
                );
                remainingQuantity = 0;
                remainingAmountCents = 0;
            }
            
            // Recalculate order totals
            const totals = await dbAsync.get(
                `SELECT 
                    COALESCE(SUM(total_price_cents), 0) as subtotal_cents
                 FROM order_items 
                 WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            const taxAmountCents = calculateTaxCents(subtotalCents, 1000);
            const totalAmountCents = subtotalCents + taxAmountCents;
            
            await dbAsync.run(
                `UPDATE orders SET 
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [subtotalCents, taxAmountCents, totalAmountCents,
                 centsToDollars(subtotalCents), centsToDollars(taxAmountCents), centsToDollars(totalAmountCents),
                 orderId]
            );
            
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            await logAuditEntry({
                organizationId,
                userId: user.id,
                locationId,
                action: isPartialComp ? 'order_item.partial_comped' : 'order_item.comped',
                entityType: 'order_item',
                entityId: itemId,
                oldValues: { 
                    total_price_cents: originalAmountCents,
                    quantity: originalQuantity,
                    is_comped: false 
                },
                newValues: { 
                    comped_quantity: qtyToComp,
                    remaining_quantity: remainingQuantity,
                    comp_amount_cents: compAmountCents,
                    is_comped: !isPartialComp,
                    comp_reason: reason,
                    new_comped_item_id: newCompedItemId
                },
                metadata: { ...getRequestMetadata(req), comped_by_username: userId }
            });
            
            return {
                status: 200,
                body: {
                    itemId,
                    orderId,
                    isComped: !isPartialComp,
                    isPartialComp,
                    compQuantity: qtyToComp,
                    remainingQuantity,
                    compReason: reason,
                    originalAmountCents,
                    compAmountCents,
                    remainingAmountCents,
                    newAmountCents: isPartialComp ? remainingAmountCents : 0,
                    newOrderTotalCents: totalAmountCents,
                    newCompedItem: newCompedItemId ? { id: newCompedItemId } : null
                }
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to comp item', details: error.message });
    }
});

// ORDER-LEVEL DISCOUNT
app.post('/orders/:orderId/discount', async (req, res) => {
    try {
        const orderId = Number(req.params.orderId);
        const { userId, discountTypeId, discountType, discountValue, reason } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }
        
        if (!discountTypeId && (!discountType || discountValue === undefined)) {
            return res.status(400).json({ error: 'Either discountTypeId or (discountType + discountValue) required' });
        }
        
        const result = await runTransactionalAction(`orders.discount.${orderId}`, req, async () => {
            const user = await getUserByUsername(userId);
            if (!user) {
                throw createHttpError(401, 'User not found');
            }
            
            if (!userHasPermission(user, 'order_discount')) {
                throw createHttpError(403, 'Permission denied: order_discount required');
            }
            
            // Lock the order
            const order = await dbAsync.get(
                'SELECT * FROM orders WHERE id = ? FOR UPDATE',
                [orderId]
            );
            
            if (!order) {
                throw createHttpError(404, 'Order not found');
            }
            
            if (['paid', 'closed', 'voided'].includes(order.status)) {
                throw createHttpError(409, `Cannot discount a ${order.status} order`);
            }
            
            // Check if order already has a discount
            const existingDiscount = await dbAsync.get(
                'SELECT id FROM discount_applications WHERE order_id = ? AND order_item_id IS NULL',
                [orderId]
            );
            if (existingDiscount) {
                throw createHttpError(409, 'Order already has a discount applied');
            }
            
            // Calculate current subtotal (excluding voided items)
            const totals = await dbAsync.get(
                `SELECT COALESCE(SUM(total_price_cents), 0) as subtotal_cents
                 FROM order_items WHERE order_id = ? AND voided_at IS NULL`,
                [orderId]
            );
            const subtotalCents = Math.round(Number(totals?.subtotal_cents || 0));
            
            // Resolve discount type
            let resolvedType = discountType;
            let resolvedValue = Number(discountValue || 0);
            let discountTypeRecord = null;
            
            if (discountTypeId) {
                discountTypeRecord = await dbAsync.get(
                    'SELECT * FROM discount_types WHERE id = ? AND is_active = true',
                    [discountTypeId]
                );
                if (!discountTypeRecord) {
                    throw createHttpError(400, 'Invalid discount type');
                }
                resolvedType = discountTypeRecord.type;
                resolvedValue = Number(discountTypeRecord.value);
                
                if (discountTypeRecord.requires_manager && !userHasPermission(user, 'manager_override')) {
                    throw createHttpError(403, 'This discount type requires manager approval');
                }
            }
            
            // Calculate discount amount
            let discountAmountCents;
            if (resolvedType === 'percentage') {
                discountAmountCents = Math.round((subtotalCents * resolvedValue) / 100);
                if (discountTypeRecord?.max_value_cents && discountAmountCents > discountTypeRecord.max_value_cents) {
                    discountAmountCents = discountTypeRecord.max_value_cents;
                }
            } else {
                discountAmountCents = Math.round(resolvedValue * 100);
            }
            
            if (discountAmountCents > subtotalCents) {
                discountAmountCents = subtotalCents;
            }
            
            // Create discount application record (order-level: order_item_id = NULL)
            await dbAsync.run(
                `INSERT INTO discount_applications (
                    order_id, order_item_id, discount_type_id, discount_type, discount_value,
                    discount_amount_cents, original_amount_cents, reason, applied_by
                ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
                [orderId, discountTypeId || null, resolvedType, resolvedValue,
                 discountAmountCents, subtotalCents, reason || null, user.id]
            );
            
            // Update order with discount
            const newSubtotalCents = subtotalCents - discountAmountCents;
            const taxAmountCents = calculateTaxCents(newSubtotalCents, 1000);
            const totalAmountCents = newSubtotalCents + taxAmountCents;
            
            await dbAsync.run(
                `UPDATE orders SET 
                    discount_amount_cents = ?,
                    subtotal_cents = ?, tax_amount_cents = ?, total_amount_cents = ?,
                    subtotal = ?, tax_amount = ?, total_amount = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [discountAmountCents,
                 newSubtotalCents, taxAmountCents, totalAmountCents,
                 centsToDollars(newSubtotalCents), centsToDollars(taxAmountCents), centsToDollars(totalAmountCents),
                 orderId]
            );
            
            const organizationId = await getDefaultOrgId();
            const locationId = await getDefaultLocationId();
            
            await logAuditEntry({
                organizationId,
                userId: user.id,
                locationId,
                action: 'order.discounted',
                entityType: 'order',
                entityId: orderId,
                oldValues: { 
                    subtotal_cents: subtotalCents,
                    discount_amount_cents: 0 
                },
                newValues: { 
                    subtotal_cents: newSubtotalCents,
                    discount_amount_cents: discountAmountCents,
                    discount_type: resolvedType,
                    discount_value: resolvedValue
                },
                metadata: { ...getRequestMetadata(req), applied_by_username: userId }
            });
            
            return {
                status: 200,
                body: {
                    orderId,
                    discountType: resolvedType,
                    discountValue: resolvedValue,
                    discountAmountCents,
                    originalSubtotalCents: subtotalCents,
                    newSubtotalCents,
                    newOrderTotalCents: totalAmountCents
                }
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to apply order discount', details: error.message });
    }
});

// ==================== LOYALTY MODULE ====================

// Get all customers with loyalty info
app.get('/loyalty/customers', async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        
        let query = `
            SELECT c.*, 
                   la.current_points, 
                   la.total_points_earned,
                   la.total_points_redeemed,
                   la.member_since,
                   lp.name as program_name
            FROM customers c
            LEFT JOIN loyalty_accounts la ON la.customer_id = c.id
            LEFT JOIN loyalty_programs lp ON lp.id = la.program_id
            WHERE c.is_active = true
        `;
        const params = [];
        
        if (search) {
            query += ` AND (c.first_name ILIKE $${params.length + 1} 
                       OR c.last_name ILIKE $${params.length + 1}
                       OR c.email ILIKE $${params.length + 1}
                       OR c.phone ILIKE $${params.length + 1}
                       OR c.loyalty_number ILIKE $${params.length + 1})`;
            params.push(`%${search}%`);
        }
        
        query += ` ORDER BY c.last_visit_date DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), offset);
        
        const customers = await dbAsync.all(query, params);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE is_active = true';
        const countParams = [];
        if (search) {
            countQuery += ` AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR loyalty_number ILIKE $1)`;
            countParams.push(`%${search}%`);
        }
        const countResult = await dbAsync.get(countQuery, countParams);
        
        res.json({ 
            customers, 
            total: Number(countResult.total),
            page: Number(page),
            limit: Number(limit)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customers', details: error.message });
    }
});

// Get single customer with full details
app.get('/loyalty/customers/:id', async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        
        const customer = await dbAsync.get(`
            SELECT c.*, 
                   la.id as loyalty_account_id,
                   la.current_points, 
                   la.total_points_earned,
                   la.total_points_redeemed,
                   la.member_since,
                   la.current_tier_id,
                   lp.id as program_id,
                   lp.name as program_name,
                   lp.points_per_dollar,
                   lp.redemption_rate,
                   lt.name as tier_name,
                   lt.multiplier as tier_multiplier,
                   lt.benefits as tier_benefits,
                   next_tier.name as next_tier_name,
                   next_tier.minimum_points as next_tier_points
            FROM customers c
            LEFT JOIN loyalty_accounts la ON la.customer_id = c.id
            LEFT JOIN loyalty_programs lp ON lp.id = la.program_id
            LEFT JOIN loyalty_tiers lt ON lt.id = la.current_tier_id
            LEFT JOIN LATERAL (
                SELECT name, minimum_points FROM loyalty_tiers 
                WHERE program_id = lp.id AND minimum_points > COALESCE(la.total_points_earned, 0) AND is_active = true
                ORDER BY minimum_points ASC LIMIT 1
            ) next_tier ON true
            WHERE c.id = ?
        `, [customerId]);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        
        // Get recent transactions
        const transactions = await dbAsync.all(`
            SELECT lt.*, o.order_number
            FROM loyalty_transactions lt
            JOIN loyalty_accounts la ON la.id = lt.account_id
            LEFT JOIN orders o ON o.id = lt.order_id
            WHERE la.customer_id = ?
            ORDER BY lt.created_at DESC
            LIMIT 20
        `, [customerId]);
        
        // Get recent orders
        const orders = await dbAsync.all(`
            SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at
            FROM orders o
            WHERE o.customer_id = ?
            ORDER BY o.created_at DESC
            LIMIT 10
        `, [customerId]);
        
        res.json({ customer, transactions, orders });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customer', details: error.message });
    }
});

// Create new customer
app.post('/loyalty/customers', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, dateOfBirth } = req.body;
        
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }
        
        const result = await runTransactionalAction('loyalty.customer.create', req, async () => {
            const organizationId = await getDefaultOrgId();
            
            // Generate loyalty number
            const loyaltyNumber = 'LYL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
            
            const { lastID: customerId } = await dbAsync.run(`
                INSERT INTO customers (organization_id, first_name, last_name, email, phone, date_of_birth, loyalty_number, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, true)
            `, [organizationId, firstName, lastName, email || null, phone || null, dateOfBirth || null, loyaltyNumber]);
            
            // Get or create default loyalty program
            let program = await dbAsync.get('SELECT id FROM loyalty_programs WHERE organization_id = ? AND is_active = true LIMIT 1', [organizationId]);
            
            if (!program) {
                // Create default program
                const { lastID: programId } = await dbAsync.run(`
                    INSERT INTO loyalty_programs (organization_id, name, description, points_per_dollar, redemption_rate, minimum_redemption, is_active)
                    VALUES (?, 'Default Rewards', 'Earn points on every purchase', 1.0, 0.01, 100, true)
                `, [organizationId]);
                program = { id: programId };
            }
            
            // Create loyalty account
            await dbAsync.run(`
                INSERT INTO loyalty_accounts (customer_id, program_id, current_points, total_points_earned, total_points_redeemed, is_active)
                VALUES (?, ?, 0, 0, 0, true)
            `, [customerId, program.id]);
            
            return { 
                status: 201, 
                body: { 
                    id: customerId, 
                    loyaltyNumber,
                    message: 'Customer created successfully' 
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create customer', details: error.message });
    }
});

// Update customer
app.put('/loyalty/customers/:id', async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        const { firstName, lastName, email, phone, dateOfBirth, marketingOptIn } = req.body;
        
        const result = await runTransactionalAction(`loyalty.customer.update.${customerId}`, req, async () => {
            const existing = await dbAsync.get('SELECT * FROM customers WHERE id = ? FOR UPDATE', [customerId]);
            if (!existing) {
                throw createHttpError(404, 'Customer not found');
            }
            
            await dbAsync.run(`
                UPDATE customers 
                SET first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    date_of_birth = COALESCE(?, date_of_birth),
                    marketing_opt_in = COALESCE(?, marketing_opt_in),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [firstName, lastName, email, phone, dateOfBirth, marketingOptIn, customerId]);
            
            return { status: 200, body: { id: customerId, message: 'Customer updated' } };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update customer', details: error.message });
    }
});

// Delete loyalty customer (requires password authentication)
app.delete('/loyalty/customers/:id', async (req, res) => {
    try {
        const customerId = Number(req.params.id);
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required for deletion' });
        }
        
        // Verify user credentials
        const user = await dbAsync.get('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check if user has permission (admin or manager role)
        if (!['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({ error: 'Only managers and admins can delete customers' });
        }
        
        const result = await runTransactionalAction(`loyalty.customer.delete.${customerId}`, req, async () => {
            const existing = await dbAsync.get('SELECT * FROM customers WHERE id = ? FOR UPDATE', [customerId]);
            if (!existing) {
                throw createHttpError(404, 'Customer not found');
            }
            
            // Soft delete: mark as inactive rather than hard delete (audit-safe)
            await dbAsync.run(`
                UPDATE customers 
                SET is_active = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [customerId]);
            
            // Also deactivate the loyalty account
            await dbAsync.run(`
                UPDATE loyalty_accounts 
                SET is_active = false
                WHERE customer_id = ?
            `, [customerId]);
            
            return { 
                status: 200, 
                body: { 
                    id: customerId, 
                    message: 'Customer deleted successfully',
                    deletedBy: user.username
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to delete customer', details: error.message });
    }
});

// Search customer by phone or loyalty number (quick lookup for POS)
app.get('/loyalty/lookup', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 3) {
            return res.json([]);
        }
        
        const customers = await dbAsync.all(`
            SELECT c.id, c.first_name, c.last_name, c.phone, c.loyalty_number,
                   la.current_points, la.total_points_earned,
                   lt.name as tier_name, lt.multiplier as tier_multiplier
            FROM customers c
            LEFT JOIN loyalty_accounts la ON la.customer_id = c.id
            LEFT JOIN loyalty_tiers lt ON lt.id = la.current_tier_id
            WHERE c.is_active = true
              AND (c.phone ILIKE ? OR c.loyalty_number ILIKE ? OR c.email ILIKE ?
                   OR CONCAT(c.first_name, ' ', c.last_name) ILIKE ?)
            LIMIT 10
        `, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
        
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to lookup customer', details: error.message });
    }
});

// Earn points (called when order is completed)
app.post('/loyalty/earn', async (req, res) => {
    try {
        const { customerId, orderId, amountSpent } = req.body;
        
        if (!customerId || !amountSpent) {
            return res.status(400).json({ error: 'Customer ID and amount spent are required' });
        }
        
        const result = await runTransactionalAction(`loyalty.earn.${customerId}.${orderId || Date.now()}`, req, async () => {
            // Get customer's loyalty account with current tier
            const account = await dbAsync.get(`
                SELECT la.*, lp.points_per_dollar, 
                       lt.multiplier as tier_multiplier, lt.name as tier_name
                FROM loyalty_accounts la
                JOIN loyalty_programs lp ON lp.id = la.program_id
                LEFT JOIN loyalty_tiers lt ON lt.id = la.current_tier_id
                WHERE la.customer_id = ? AND la.is_active = true
                FOR UPDATE
            `, [customerId]);
            
            if (!account) {
                throw createHttpError(404, 'Loyalty account not found');
            }
            
            // Calculate points to earn: 1 point per 10 baht spent, multiplied by tier multiplier
            const tierMultiplier = Number(account.tier_multiplier) || 1.0;
            const basePoints = Math.floor(Number(amountSpent) / 10);
            const pointsEarned = Math.floor(basePoints * tierMultiplier);
            
            if (pointsEarned <= 0) {
                return { status: 200, body: { pointsEarned: 0, message: 'No points earned' } };
            }
            
            const newTotalPoints = (account.total_points_earned || 0) + pointsEarned;
            
            // Update account
            await dbAsync.run(`
                UPDATE loyalty_accounts 
                SET current_points = current_points + ?,
                    total_points_earned = total_points_earned + ?,
                    last_activity = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [pointsEarned, pointsEarned, account.id]);
            
            // Record transaction
            await dbAsync.run(`
                INSERT INTO loyalty_transactions (account_id, transaction_type, points, order_id, description)
                VALUES (?, 'earn', ?, ?, ?)
            `, [account.id, pointsEarned, orderId || null, `Earned ${pointsEarned} points (${tierMultiplier}x multiplier)`]);
            
            // Check for tier upgrade
            const newTier = await dbAsync.get(`
                SELECT id, name, multiplier FROM loyalty_tiers 
                WHERE program_id = ? AND minimum_points <= ? AND is_active = true
                ORDER BY minimum_points DESC LIMIT 1
            `, [account.program_id, newTotalPoints]);
            
            let tierUpgrade = null;
            if (newTier && newTier.id !== account.current_tier_id) {
                await dbAsync.run('UPDATE loyalty_accounts SET current_tier_id = ? WHERE id = ?', [newTier.id, account.id]);
                tierUpgrade = { newTier: newTier.name, newMultiplier: newTier.multiplier };
                
                // Record tier upgrade transaction
                await dbAsync.run(`
                    INSERT INTO loyalty_transactions (account_id, transaction_type, points, description)
                    VALUES (?, 'tier_upgrade', 0, ?)
                `, [account.id, `Upgraded to ${newTier.name}!`]);
            }
            
            // Update customer stats
            await dbAsync.run(`
                UPDATE customers 
                SET total_visits = total_visits + 1,
                    total_spent = total_spent + ?,
                    last_visit_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [amountSpent, customerId]);
            
            const updatedAccount = await dbAsync.get('SELECT current_points FROM loyalty_accounts WHERE id = ?', [account.id]);
            
            return { 
                status: 200, 
                body: { 
                    pointsEarned,
                    basePoints,
                    multiplier: tierMultiplier,
                    currentTier: account.tier_name || 'Nugget',
                    newBalance: updatedAccount.current_points,
                    tierUpgrade,
                    message: tierUpgrade 
                        ? `🎉 Earned ${pointsEarned} points and upgraded to ${tierUpgrade.newTier}!`
                        : `Earned ${pointsEarned} points!` 
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to earn points', details: error.message });
    }
});

// Redeem points
app.post('/loyalty/redeem', async (req, res) => {
    try {
        const { customerId, pointsToRedeem, orderId } = req.body;
        
        if (!customerId || !pointsToRedeem || pointsToRedeem <= 0) {
            return res.status(400).json({ error: 'Customer ID and valid points amount are required' });
        }
        
        const result = await runTransactionalAction(`loyalty.redeem.${customerId}.${orderId || Date.now()}`, req, async () => {
            // Get customer's loyalty account
            const account = await dbAsync.get(`
                SELECT la.*, lp.redemption_rate, lp.minimum_redemption
                FROM loyalty_accounts la
                JOIN loyalty_programs lp ON lp.id = la.program_id
                WHERE la.customer_id = ? AND la.is_active = true
                FOR UPDATE
            `, [customerId]);
            
            if (!account) {
                throw createHttpError(404, 'Loyalty account not found');
            }
            
            if (account.current_points < pointsToRedeem) {
                throw createHttpError(400, `Insufficient points. Available: ${account.current_points}`);
            }
            
            if (pointsToRedeem < account.minimum_redemption) {
                throw createHttpError(400, `Minimum redemption is ${account.minimum_redemption} points`);
            }
            
            // Calculate dollar value
            const dollarValue = pointsToRedeem * account.redemption_rate;
            
            // Update account
            await dbAsync.run(`
                UPDATE loyalty_accounts 
                SET current_points = current_points - ?,
                    total_points_redeemed = total_points_redeemed + ?,
                    last_activity = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [pointsToRedeem, pointsToRedeem, account.id]);
            
            // Record transaction
            await dbAsync.run(`
                INSERT INTO loyalty_transactions (account_id, transaction_type, points, order_id, description)
                VALUES (?, 'redeem', ?, ?, ?)
            `, [account.id, -pointsToRedeem, orderId || null, `Redeemed ${pointsToRedeem} points for $${dollarValue.toFixed(2)} discount`]);
            
            const updatedAccount = await dbAsync.get('SELECT current_points FROM loyalty_accounts WHERE id = ?', [account.id]);
            
            return { 
                status: 200, 
                body: { 
                    pointsRedeemed: pointsToRedeem, 
                    dollarValue,
                    newBalance: updatedAccount.current_points,
                    message: `Redeemed ${pointsToRedeem} points for $${dollarValue.toFixed(2)}!` 
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to redeem points', details: error.message });
    }
});

// Get loyalty programs
app.get('/loyalty/programs', async (req, res) => {
    try {
        const programs = await dbAsync.all(`
            SELECT lp.*, 
                   COUNT(la.id) as member_count,
                   SUM(la.current_points) as total_outstanding_points
            FROM loyalty_programs lp
            LEFT JOIN loyalty_accounts la ON la.program_id = lp.id AND la.is_active = true
            WHERE lp.is_active = true
            GROUP BY lp.id
            ORDER BY lp.created_at DESC
        `);
        
        res.json(programs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch programs', details: error.message });
    }
});

// Get loyalty stats/dashboard
app.get('/loyalty/stats', async (req, res) => {
    try {
        const stats = await dbAsync.get(`
            SELECT 
                COUNT(DISTINCT c.id) as total_customers,
                COUNT(DISTINCT la.id) as loyalty_members,
                COALESCE(SUM(la.current_points), 0) as total_outstanding_points,
                COALESCE(SUM(la.total_points_earned), 0) as total_points_earned,
                COALESCE(SUM(la.total_points_redeemed), 0) as total_points_redeemed
            FROM customers c
            LEFT JOIN loyalty_accounts la ON la.customer_id = c.id AND la.is_active = true
            WHERE c.is_active = true
        `);
        
        // Recent activity
        const recentTransactions = await dbAsync.all(`
            SELECT lt.*, c.first_name, c.last_name
            FROM loyalty_transactions lt
            JOIN loyalty_accounts la ON la.id = lt.account_id
            JOIN customers c ON c.id = la.customer_id
            ORDER BY lt.created_at DESC
            LIMIT 10
        `);
        
        // Top customers
        const topCustomers = await dbAsync.all(`
            SELECT c.id, c.first_name, c.last_name, c.loyalty_number,
                   la.current_points, la.total_points_earned, c.total_spent
            FROM customers c
            JOIN loyalty_accounts la ON la.customer_id = c.id
            WHERE c.is_active = true AND la.is_active = true
            ORDER BY la.total_points_earned DESC
            LIMIT 10
        `);
        
        res.json({ stats, recentTransactions, topCustomers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
});

// Adjust points (admin)
app.post('/loyalty/adjust', async (req, res) => {
    try {
        const { customerId, points, reason } = req.body;
        
        if (!customerId || points === undefined || !reason) {
            return res.status(400).json({ error: 'Customer ID, points, and reason are required' });
        }
        
        const result = await runTransactionalAction(`loyalty.adjust.${customerId}.${Date.now()}`, req, async () => {
            const account = await dbAsync.get(`
                SELECT la.* FROM loyalty_accounts la
                WHERE la.customer_id = ? AND la.is_active = true
                FOR UPDATE
            `, [customerId]);
            
            if (!account) {
                throw createHttpError(404, 'Loyalty account not found');
            }
            
            const newBalance = account.current_points + points;
            if (newBalance < 0) {
                throw createHttpError(400, 'Adjustment would result in negative balance');
            }
            
            await dbAsync.run(`
                UPDATE loyalty_accounts 
                SET current_points = ?,
                    last_activity = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [newBalance, account.id]);
            
            await dbAsync.run(`
                INSERT INTO loyalty_transactions (account_id, transaction_type, points, description)
                VALUES (?, 'adjustment', ?, ?)
            `, [account.id, points, `Adjustment: ${reason}`]);
            
            return { 
                status: 200, 
                body: { 
                    previousBalance: account.current_points,
                    adjustment: points,
                    newBalance,
                    message: 'Points adjusted successfully' 
                } 
            };
        });
        
        res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to adjust points', details: error.message });
    }
});

// Get all loyalty tiers
app.get('/loyalty/tiers', async (req, res) => {
    try {
        const tiers = await dbAsync.all(`
            SELECT lt.*, lp.name as program_name,
                   (SELECT COUNT(*) FROM loyalty_accounts la WHERE la.current_tier_id = lt.id) as member_count
            FROM loyalty_tiers lt
            JOIN loyalty_programs lp ON lp.id = lt.program_id
            WHERE lt.is_active = true
            ORDER BY lt.minimum_points ASC
        `);
        res.json(tiers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tiers', details: error.message });
    }
});

// Update a tier
app.put('/loyalty/tiers/:id', async (req, res) => {
    try {
        const tierId = Number(req.params.id);
        const { name, description, minimum_points, multiplier, benefits } = req.body;
        
        const existing = await dbAsync.get('SELECT * FROM loyalty_tiers WHERE id = ?', [tierId]);
        if (!existing) {
            return res.status(404).json({ error: 'Tier not found' });
        }
        
        await dbAsync.run(`
            UPDATE loyalty_tiers 
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                minimum_points = COALESCE(?, minimum_points),
                multiplier = COALESCE(?, multiplier),
                benefits = COALESCE(?::jsonb, benefits)
            WHERE id = ?
        `, [name, description, minimum_points, multiplier, benefits ? JSON.stringify(benefits) : null, tierId]);
        
        const updated = await dbAsync.get('SELECT * FROM loyalty_tiers WHERE id = ?', [tierId]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update tier', details: error.message });
    }
});

// Recalculate all customer tiers (admin function)
app.post('/loyalty/tiers/recalculate', async (req, res) => {
    try {
        const result = await dbAsync.run(`
            UPDATE loyalty_accounts la
            SET current_tier_id = (
                SELECT lt.id 
                FROM loyalty_tiers lt 
                WHERE lt.program_id = la.program_id 
                  AND lt.minimum_points <= la.total_points_earned
                  AND lt.is_active = true
                ORDER BY lt.minimum_points DESC 
                LIMIT 1
            )
        `);
        
        res.json({ 
            message: 'Tiers recalculated successfully',
            accountsUpdated: result.changes
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to recalculate tiers', details: error.message });
    }
});

// ==================== END LOYALTY MODULE ====================

// Start server
async function startServer() {
    try {
        console.log('--- SERVER STARTUP INFO ---');
        console.log('Server file:', __filename);
        console.log('Listening port:', port);
        console.log('DB host:', process.env.PG_HOST || 'localhost');
        console.log('DB port:', process.env.PG_PORT || 5433);
        console.log('DB name:', process.env.PG_DATABASE || 'universal_pos');
        console.log('---------------------------');
        
        await runMigrations();
        await ensureSeedData();
        // Test database connection
        await dbAsync.get('SELECT 1');
        console.log('Database connection successful');

        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`Universal POS server running on port ${port}`);
            console.log(`Access the UI at: http://localhost:${port}`);
        });

        server.on('error', (err) => {
            console.error('Server error:', err);
            process.exit(1);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down...');
            server.close(() => process.exit(0));
        });
        
        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down...');
            server.close(() => process.exit(0));
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

startServer();
