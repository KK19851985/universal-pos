const fs = require('fs');
const path = require('path');
const { pool, dbAsync } = require('./db');

// Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
function makeIdempotent(sql) {
    return sql
        .replace(/CREATE TABLE(?!\s+IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS')
        .replace(/CREATE INDEX(?!\s+IF\s+NOT\s+EXISTS)/gi, 'CREATE INDEX IF NOT EXISTS')
        .replace(/CREATE UNIQUE INDEX(?!\s+IF\s+NOT\s+EXISTS)/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS');
}

async function runMigrations() {
    try {
        console.log('Starting PostgreSQL database migrations...');

        // Create migrations table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Check existing tables
        const tablesResult = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        const existingTableSet = new Set(tablesResult.rows.map(t => t.table_name));
        console.log('Existing tables:', Array.from(existingTableSet));

        // Check what migrations have been run
        let runMigrationsList = [];
        try {
            const migrationsResult = await pool.query(
                "SELECT version FROM schema_migrations ORDER BY version"
            );
            runMigrationsList = migrationsResult.rows;
        } catch (error) {
            runMigrationsList = [];
        }
        console.log('Run migrations:', runMigrationsList.map(m => m.version));

        // Get list of migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const version = file.replace('.sql', '');

            // Check if migration already executed
            const result = await dbAsync.get(
                'SELECT version FROM schema_migrations WHERE version = $1',
                [version]
            );

            if (result) {
                console.log(`Migration ${version} already executed, skipping...`);
                continue;
            }

            console.log(`Executing migration ${version}...`);

            // Read migration SQL (already PostgreSQL format)
            const migrationPath = path.join(migrationsDir, file);
            let sql = fs.readFileSync(migrationPath, 'utf8');
            
            // Make SQL idempotent (add IF NOT EXISTS)
            sql = makeIdempotent(sql);

            try {
                // Execute entire migration in a transaction
                await pool.query('BEGIN');
                await pool.query(sql);
                
                // Record migration as complete
                await pool.query(
                    'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
                    [version]
                );
                
                await pool.query('COMMIT');
                console.log(`Migration ${version} completed successfully.`);
            } catch (error) {
                await pool.query('ROLLBACK');
                console.error(`Migration ${version} failed:`, error.message);
                throw error;
            }
        }

        console.log('All migrations completed successfully!');

    } catch (error) {
        console.error('Migration process failed:', error);
        process.exit(1);
    }
}

// Run migrations if this script is executed directly
if (require.main === module) {
    runMigrations().then(() => {
        console.log('Migration process completed.');
        process.exit(0);
    }).catch((error) => {
        console.error('Migration process failed:', error);
        process.exit(1);
    });
}

module.exports = { runMigrations };
