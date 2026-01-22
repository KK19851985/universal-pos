const { Pool } = require('pg');

// PostgreSQL connection configuration
// SECURITY: In production, PG_PASSWORD must be set via environment variable
const poolConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5433,
    database: process.env.PG_DATABASE || 'universal_pos',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || process.env.PGPASSWORD, // No hardcoded fallback
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    // Keep connections alive
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
};

let pool = new Pool(poolConfig);
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 3000;
const HEALTH_CHECK_INTERVAL_MS = 30000;

// Connection event handlers
pool.on('connect', (client) => {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('✅ PostgreSQL client connected');
});

pool.on('error', (err, client) => {
    console.error('❌ PostgreSQL pool error:', err.message);
    isConnected = false;
    // Don't exit - let the health check handle reconnection
});

pool.on('remove', (client) => {
    console.log('PostgreSQL client removed from pool');
});

// Initial connection test
async function testConnection() {
    try {
        await pool.query('SELECT NOW()');
        isConnected = true;
        reconnectAttempts = 0;
        console.log('✅ Connected to PostgreSQL database.');
        return true;
    } catch (err) {
        isConnected = false;
        console.error('❌ Error connecting to PostgreSQL:', err.message);
        return false;
    }
}

// Reconnection logic
async function reconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`❌ Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
        return false;
    }
    
    reconnectAttempts++;
    console.log(`🔄 Attempting to reconnect to PostgreSQL (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    
    try {
        // End the old pool gracefully
        await pool.end().catch(() => {});
        
        // Create a new pool
        pool = new Pool(poolConfig);
        
        // Re-attach event handlers
        pool.on('connect', () => {
            isConnected = true;
            reconnectAttempts = 0;
            console.log('✅ PostgreSQL reconnected successfully');
        });
        
        pool.on('error', (err) => {
            console.error('❌ PostgreSQL pool error:', err.message);
            isConnected = false;
        });
        
        // Test the new connection
        const connected = await testConnection();
        if (connected) {
            // Update the exported pool reference
            module.exports.pool = pool;
            module.exports.db = pool;
            return true;
        }
    } catch (err) {
        console.error('❌ Reconnection failed:', err.message);
    }
    
    return false;
}

// Health check - runs periodically to ensure connection is alive
async function healthCheck() {
    try {
        const result = await pool.query('SELECT 1 as health');
        if (result.rows[0]?.health === 1) {
            if (!isConnected) {
                console.log('✅ PostgreSQL connection restored');
            }
            isConnected = true;
            reconnectAttempts = 0;
            return true;
        }
    } catch (err) {
        console.error('❌ PostgreSQL health check failed:', err.message);
        isConnected = false;
        
        // Attempt reconnection
        await reconnect();
    }
    return isConnected;
}

// Start periodic health checks
let healthCheckInterval = null;
function startHealthChecks() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    healthCheckInterval = setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);
    console.log(`🔄 PostgreSQL health checks running every ${HEALTH_CHECK_INTERVAL_MS / 1000}s`);
}

// Get connection status
function getConnectionStatus() {
    return {
        isConnected,
        reconnectAttempts,
        poolTotalCount: pool.totalCount,
        poolIdleCount: pool.idleCount,
        poolWaitingCount: pool.waitingCount,
    };
}

// Initial connection test
testConnection().then(connected => {
    if (connected) {
        startHealthChecks();
    } else {
        // Retry initial connection
        setTimeout(async () => {
            const retryConnected = await reconnect();
            if (retryConnected) {
                startHealthChecks();
            }
        }, RECONNECT_DELAY_MS);
    }
});

// Promisify database operations for compatibility with existing code
const dbAsync = {
    // Run a query (INSERT, UPDATE, DELETE)
    run: async (sql, params = []) => {
        // Convert ? placeholders to $1, $2, etc. for PostgreSQL
        // Also convert SQLite-style booleans to PostgreSQL
        let pgSql = convertSqliteToPostgres(sql);
        const pgParams = convertParams(params);
        
        // Add RETURNING id to INSERT statements if not already present
        if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
            pgSql = pgSql.replace(/;?\s*$/, ' RETURNING id');
        }
        
        const result = await pool.query(pgSql, pgParams);
        return { 
            lastID: result.rows[0]?.id || null, 
            changes: result.rowCount 
        };
    },

    // Get a single row
    get: async (sql, params = []) => {
        const pgSql = convertSqliteToPostgres(sql);
        const pgParams = convertParams(params);
        const result = await pool.query(pgSql, pgParams);
        return result.rows[0] || null;
    },

    // Get all rows
    all: async (sql, params = []) => {
        const pgSql = convertSqliteToPostgres(sql);
        const pgParams = convertParams(params);
        const result = await pool.query(pgSql, pgParams);
        return result.rows;
    },

    // Execute raw query (for migrations)
    exec: async (sql) => {
        await pool.query(sql);
    }
};

// Convert SQLite-style SQL to PostgreSQL
function convertSqliteToPostgres(sql) {
    let index = 0;
    let result = sql
        // Replace ? with $1, $2, etc.
        .replace(/\?/g, () => `$${++index}`)
        // Handle INSERT OR REPLACE (SQLite) -> INSERT ON CONFLICT (PostgreSQL)
        .replace(/INSERT OR REPLACE INTO/gi, 'INSERT INTO');
    
    // Only convert known boolean columns - be specific to avoid converting numeric 0/1
    // Boolean columns in our schema: is_active, requires_deposit, is_available, 
    // is_default, is_credit, is_void, is_refund, requires_manager_approval
    const booleanColumns = [
        'is_active', 'requires_deposit', 'is_available', 'is_default',
        'is_credit', 'is_void', 'is_refund', 'requires_manager_approval',
        'is_taxable', 'is_discountable', 'track_inventory', 'allow_fractional',
        'is_primary', 'is_verified', 'is_locked', 'is_redeemed', 'is_expired',
        'is_cancelled', 'is_completed', 'is_confirmed', 'is_seated', 'is_no_show',
        'auto_apply', 'is_combinable', 'requires_code'
    ];
    
    // Replace column = 1/0 patterns for known boolean columns
    for (const col of booleanColumns) {
        const regex1 = new RegExp(`${col}\\s*=\\s*1`, 'gi');
        const regex0 = new RegExp(`${col}\\s*=\\s*0`, 'gi');
        result = result.replace(regex1, `${col} = true`);
        result = result.replace(regex0, `${col} = false`);
    }
    
    return result;
}

// Convert params - handle boolean values
function convertParams(params) {
    return params.map(param => {
        // Leave as-is - PostgreSQL driver handles most conversions
        return param;
    });
}

// Graceful shutdown
async function closePool() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
    }
    await pool.end();
    console.log('PostgreSQL pool closed');
}

// Export pool for direct access if needed
module.exports = { 
    db: pool, 
    dbAsync, 
    pool,
    getConnectionStatus,
    healthCheck,
    reconnect,
    closePool
};
