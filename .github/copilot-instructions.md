# UniversalPOS - AI Coding Agent Instructions

## Architecture Overview

UniversalPOS is a **single Express server** (`backend/server.js`) serving both API and static UI from `public/`. The TypeScript files in `core/`, `modules/`, `shared/` are **architectural scaffolding only** - not connected to the working system.

**Database**: PostgreSQL on port 5433 (not default 5432). Connection in [backend/db.js](../backend/db.js).

**Key architectural decision**: `db.js` translates SQLite-style `?` placeholders to PostgreSQL `$1, $2` syntax, enabling code to use either style.

## Quick Start

```bash
# Start server (use the batch file for reliable startup)
backend\start-server.bat

# Or manually:
$env:PG_PASSWORD = "your_password"
cd backend
node server.js

# Access UI at http://localhost:5000
# Default login: admin / admin123
```

## Critical Patterns

### Money: Integer Cents Only

All currency stored as **integer cents** (`*_cents` columns). Never use floats for money.

```javascript
// ✅ Correct - use dollarsToCents/centsToDollars from server.js
const priceCents = dollarsToCents(19.99);  // → 1999
const tax = calculateTaxCents(subtotalCents, 1000);  // 1000 bps = 10%

// ❌ Wrong - never do float math on money
const total = subtotal * 1.08;
```

### State Machines with Guards

Tables, orders, and reservations use **strict state machines**. See [docs/RESTAURANT_CYCLE_BLUEPRINT.md](../docs/RESTAURANT_CYCLE_BLUEPRINT.md).

```javascript
// Table states: available → reserved/seated → billed → needs_cleaning → available
const validTransitions = {
    'available': ['reserved', 'seated', 'blocked'],
    'seated': ['billed'],  // Cannot skip billed!
    'billed': ['needs_cleaning'],
    // ...
};
if (!validTransitions[current].includes(newStatus)) throw createHttpError(409, ...);
```

### Idempotency for All Mutating Endpoints

Use `runTransactionalAction(action, req, handler)` for POST endpoints. Clients pass `Idempotency-Key` header.

```javascript
app.post('/endpoint', async (req, res) => {
    const result = await runTransactionalAction('action.name', req, async () => {
        // Your logic here
        return { status: 200, body: { ... } };
    });
    res.status(result.status).json(result.body);
});
```

### Audit-Safe History (Append-Only)

**Never DELETE from history tables**. Use `ended_at` pattern for `table_statuses`:

```javascript
// ✅ Correct - soft-close the row
await dbAsync.run(
    `UPDATE table_statuses SET ended_at = CURRENT_TIMESTAMP 
     WHERE table_id = ? AND status = 'seated' AND ended_at IS NULL`, [tableId]
);

// ❌ Wrong - destroys audit trail
await dbAsync.run('DELETE FROM table_statuses WHERE ...', [...]);
```

### PostgreSQL Boolean Values

Use `true`/`false` (not `1`/`0`) in INSERT statements for boolean columns:

```javascript
// ✅ Correct
'INSERT INTO users (..., is_active) VALUES (..., true)'

// ❌ Wrong - PostgreSQL rejects integer for boolean
'INSERT INTO users (..., is_active) VALUES (..., 1)'
```

### Row-Level Locking for Concurrency

Use `FOR UPDATE` when reading data that will be modified:

```javascript
const table = await dbAsync.get('SELECT id FROM tables WHERE id = ? FOR UPDATE', [id]);
```

## Developer Workflow

```bash
cd backend
npm install
npm run migrate   # Run SQL migrations from backend/migrations/
npm start         # Port 5000 (API + UI)
npm run dev       # Auto-reload with nodemon
```

**Preflight tests**: `node backend/tests/preflight-full.js` (requires running server)

## Migrations

Files in `backend/migrations/` run in alphabetical order. Key migrations:
- `15_production_hardening.sql`: Added `*_cents` columns, concurrency indexes
- `16_audit_safe_history.sql`: Added `ended_at` for append-only pattern

Migrations are made idempotent automatically (`CREATE TABLE IF NOT EXISTS`).

## API Conventions

- All endpoints under `/api/` have rate limiting (100 req/15min)
- Restaurant module: `/restaurant/tables`, `/restaurant/reservations`, `/restaurant/kitchen/*`
- User ID passed via `userId` in body or `x-user-id` header
- Permission middleware: `requirePermission('void_item')` decorates routes
