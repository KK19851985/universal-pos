// SQLite Migration Runner
const fs = require('fs');
const path = require('path');
const { db, dbAsync } = require('./db-sqlite');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations-sqlite');

async function runMigrations() {
    console.log('Starting SQLite database migrations...');
    
    // Get list of migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');
        
        // Check if already executed
        try {
            const existing = await dbAsync.get(
                'SELECT id FROM schema_migrations WHERE name = ?',
                [migrationName]
            );
            
            if (existing) {
                console.log(`  ✓ ${migrationName} (already applied)`);
                continue;
            }
        } catch (err) {
            // schema_migrations table doesn't exist yet, will be created by migration
        }
        
        // Run migration
        console.log(`  → Running ${migrationName}...`);
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        
        try {
            db.exec(sql);
            console.log(`  ✓ ${migrationName} completed`);
        } catch (err) {
            console.error(`  ✗ ${migrationName} FAILED:`, err.message);
            throw err;
        }
    }
    
    console.log('All migrations completed successfully!');
}

module.exports = { runMigrations };

// Run if called directly
if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}
