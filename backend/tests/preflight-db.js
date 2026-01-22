const { Pool } = require('pg');

// Use environment variables with fallbacks for local development
const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5433,
    database: process.env.PG_DATABASE || 'universal_pos',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || process.env.PGPASSWORD
});

async function runChecks() {
    console.log('=== B) DATABASE CERTAINTY ===\n');
    
    // B1: Database connection info
    const dbInfo = await pool.query('SELECT current_database() as db, inet_server_port() as port');
    console.log('B1. Database Connection:');
    console.log('   current_database:', dbInfo.rows[0].db);
    console.log('   inet_server_port:', dbInfo.rows[0].port);
    
    // B2: Table counts
    console.log('\nB2. Table Counts:');
    const tables = ['users', 'orders', 'payments', 'audit_log', 'idempotency_keys', 'table_statuses'];
    for (const table of tables) {
        try {
            const result = await pool.query(`SELECT COUNT(*)::int as cnt FROM ${table}`);
            console.log(`   ${table}: ${result.rows[0].cnt}`);
        } catch (e) {
            console.log(`   ${table}: ERROR - ${e.message}`);
        }
    }
    
    // B3: Check idempotency_keys constraint
    console.log('\n=== D) IDEMPOTENCY CHECKS ===\n');
    const constraints = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'idempotency_keys'::regclass
        AND contype = 'u'
    `);
    console.log('D1. Unique constraints on idempotency_keys:');
    constraints.rows.forEach(r => console.log(`   ${r.conname}: ${r.definition}`));
    
    // Check for partial unique index on table_statuses
    console.log('\n=== E) CONCURRENCY CHECKS ===\n');
    const indexes = await pool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'table_statuses'
    `);
    console.log('E1. Indexes on table_statuses:');
    indexes.rows.forEach(r => console.log(`   ${r.indexname}`));
    indexes.rows.forEach(r => {
        if (r.indexdef.includes('WHERE')) {
            console.log(`   PARTIAL: ${r.indexdef}`);
        }
    });
    
    // Check for DELETE statements pattern (will do via grep separately)
    console.log('\n=== F) AUDITABILITY ===\n');
    const tableStatusesCols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'table_statuses'
        ORDER BY ordinal_position
    `);
    console.log('F1. table_statuses columns:');
    tableStatusesCols.rows.forEach(r => console.log(`   ${r.column_name}: ${r.data_type}`));
    
    const hasEndedAt = tableStatusesCols.rows.some(r => r.column_name === 'ended_at');
    console.log(`\n   ended_at column exists: ${hasEndedAt ? 'YES ✓' : 'NO ✗'}`);
    
    await pool.end();
}

runChecks().catch(console.error);
