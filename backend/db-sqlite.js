// Universal POS - SQLite Database Connection
// No external database server needed - everything runs in Node.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = process.env.DB_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'pos.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${DB_DIR}`);
}

// Create database connection
let db;
let isConnected = false;

function initDatabase() {
    try {
        db = new Database(DB_FILE, { 
            verbose: process.env.DEBUG_SQL ? console.log : null 
        });
        
        // Enable foreign keys
        db.pragma('foreign_keys = ON');
        
        // Enable WAL mode for better concurrency
        db.pragma('journal_mode = WAL');
        
        // Optimize for performance
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = -64000'); // 64MB cache
        
        isConnected = true;
        console.log(`✅ Connected to SQLite database: ${DB_FILE}`);
        return true;
    } catch (err) {
        console.error('❌ Error connecting to SQLite:', err.message);
        isConnected = false;
        return false;
    }
}

// Initialize on load
initDatabase();

// Async wrapper for compatibility with existing PostgreSQL-style code
const dbAsync = {
    // Run a query (INSERT, UPDATE, DELETE)
    run: async (sql, params = []) => {
        try {
            // Convert PostgreSQL $1, $2 placeholders to SQLite ? placeholders
            const sqliteSql = convertPgToSqlite(sql);
            const stmt = db.prepare(sqliteSql);
            const result = stmt.run(...params);
            return { 
                lastID: result.lastInsertRowid, 
                changes: result.changes 
            };
        } catch (err) {
            console.error('SQL Error:', err.message, '\nSQL:', sql);
            throw err;
        }
    },

    // Get a single row
    get: async (sql, params = []) => {
        try {
            const sqliteSql = convertPgToSqlite(sql);
            const stmt = db.prepare(sqliteSql);
            return stmt.get(...params) || null;
        } catch (err) {
            console.error('SQL Error:', err.message, '\nSQL:', sql);
            throw err;
        }
    },

    // Get all rows
    all: async (sql, params = []) => {
        try {
            const sqliteSql = convertPgToSqlite(sql);
            const stmt = db.prepare(sqliteSql);
            return stmt.all(...params);
        } catch (err) {
            console.error('SQL Error:', err.message, '\nSQL:', sql);
            throw err;
        }
    },

    // Execute raw query (for migrations)
    exec: async (sql) => {
        try {
            db.exec(sql);
        } catch (err) {
            console.error('SQL Exec Error:', err.message);
            throw err;
        }
    }
};

// Convert PostgreSQL syntax to SQLite
function convertPgToSqlite(sql) {
    let result = sql
        // Convert $1, $2 to ?
        .replace(/\$\d+/g, '?')
        // Remove RETURNING clause (SQLite handles this differently)
        .replace(/\s+RETURNING\s+\w+/gi, '')
        // Convert PostgreSQL boolean literals
        .replace(/\bTRUE\b/gi, '1')
        .replace(/\bFALSE\b/gi, '0')
        // Remove FOR UPDATE (not needed in SQLite - it's single-writer)
        .replace(/\s+FOR\s+UPDATE/gi, '')
        // Convert NOW() to SQLite's datetime
        .replace(/\bNOW\(\)/gi, "datetime('now')")
        .replace(/\bCURRENT_TIMESTAMP\b/gi, "datetime('now')")
        // Convert PostgreSQL INTERVAL
        .replace(/CURRENT_TIMESTAMP\s*-\s*INTERVAL\s+'(\d+)\s+(\w+)'/gi, 
            (match, num, unit) => `datetime('now', '-${num} ${unit.toLowerCase()}')`);
    
    return result;
}

// Transaction helper
function runTransaction(fn) {
    const transaction = db.transaction(fn);
    return transaction();
}

// Get connection status
function getConnectionStatus() {
    return {
        isConnected,
        dbFile: DB_FILE,
        fileExists: fs.existsSync(DB_FILE),
        fileSizeBytes: fs.existsSync(DB_FILE) ? fs.statSync(DB_FILE).size : 0
    };
}

// Health check
async function healthCheck() {
    try {
        db.prepare('SELECT 1').get();
        isConnected = true;
        return true;
    } catch (err) {
        console.error('❌ SQLite health check failed:', err.message);
        isConnected = false;
        return false;
    }
}

// Graceful shutdown
function closeDatabase() {
    if (db) {
        db.close();
        console.log('SQLite database closed');
    }
}

// Handle process exit
process.on('exit', closeDatabase);
process.on('SIGINT', () => { closeDatabase(); process.exit(0); });
process.on('SIGTERM', () => { closeDatabase(); process.exit(0); });

module.exports = { 
    db,
    dbAsync, 
    getConnectionStatus,
    healthCheck,
    closeDatabase,
    runTransaction,
    initDatabase
};
