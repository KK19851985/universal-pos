# UNIVERSAL MODULAR POS

## Overview

Universal Modular POS (UniversalPOS) is a scalable, configurable Point-of-Sale platform designed to serve multiple industries, including restaurants, retail, warehouses/stock operations, and service businesses. It is built around a stable core framework with optional modules that can be enabled or disabled based on operational needs.

Core philosophy:

**Protect the integrity of the business record while keeping workflows fast and unambiguous.**

---

## Quick Start (Recommended: Single-Port Mode)

UniversalPOS runs as a single Express server that serves:
- API routes
- Web UI static files from `public/`

### Prerequisites
- PostgreSQL installed and running
- Host: `localhost`
- Port: `5433`
- Database: `universal_pos`
- User: `postgres`

### Install + Run
```bash
cd backend
npm install
npm run migrate
npm start
Access
UI: http://localhost:5000

API Health: http://localhost:5000/api/health

Default Login
Username: admin

Password: admin123

Optional: Development Auto-Reload
bash
Copy code
cd backend
npm run dev
Ports & Troubleshooting (Important)
Expected ports
5000 — UniversalPOS backend (API + UI)

5433 — PostgreSQL

You should not use port 3000 or 4000 unless you intentionally started another server. Running multiple servers can cause confusing behavior (UI loads, but API calls fail or hit a different instance).

Quick checks (Windows)
bat
Copy code
netstat -ano | findstr :5000
netstat -ano | findstr :5433
tasklist | findstr node
Verify correct backend instance
http://localhost:5000/api/health

http://localhost:5000/build/info (may be restricted in production)

Project Structure
Working System (backend/)
The production-ready backend is in backend/:

server.js — Main Express server (API + static UI)

db.js — PostgreSQL connection

runMigrations.js — Database migration runner

migrations/ — SQL migrations

Frontend (public/)
index.html — Main UI entrypoint

app.js — Frontend JavaScript (SPA behavior)

styles.css — Styling

Documentation (docs/)
RESTAURANT_CYCLE_BLUEPRINT.md — State machine documentation for restaurant operations

TypeScript Architecture Reference (core/, modules/, shared/)
These folders contain TypeScript scaffolding that illustrates the intended modular architecture. They are not connected to the current working backend and serve as an architectural reference for a future TypeScript migration.

Restaurant Operational Cycle
UniversalPOS implements a complete restaurant workflow with strict state machine guards.

Table States
available → can be seated or reserved

reserved → waiting for reservation arrival

seated → active dining

billed → bill generated, awaiting payment

needs_cleaning → order closed, awaiting cleaning

blocked → maintenance/VIP hold

Reservation States
pending → new reservation

confirmed → staff confirmed; table may be reserved

arrived → guest checked in

seated → guest seated (linked to order)

no_show / cancelled / completed → terminal states

Order States
open → items can be added

sent_to_kitchen → items queued

billed → bill generated

paid → payment completed

closed → terminal state

Complete Flow
text
Copy code
1. Create Reservation → pending
2. Confirm → confirmed (table: reserved)
3. Guest Arrives → arrived
4. Seat (auto) → order created (table: seated)
5. Add Items → order items in cart
6. Send to Kitchen → items: pending → preparing → ready → served
7. Generate Bill → order: billed (table: billed)
8. Process Payment → order: paid
9. Close Order → order: closed (table: needs_cleaning)
10. Clear Table → table: available
Features
Core Framework: authentication, guarded workflows, billing, payments, reporting scaffolding

Modular Design: restaurant, retail, warehouse, loyalty modules (expandable)

Scalability: supports single-device through multi-device operation

Data Integrity: atomic transactions, idempotency for critical actions, complete audit trail

User Workflow: designed for fast operation with minimal ambiguity

Architecture
Core Services (Conceptual)
AuthService — JWT authentication, password hashing

CatalogService — product/service catalog

OrderService — order lifecycle and item management

PaymentService — payment processing with idempotency

ReportingService — reporting endpoints/scaffolding

AuditService — append-only audit logging

SyncService — real-time updates (Socket.IO)

ConfigService — system configuration and toggles

ApiService — Express route layer

Modules (Conceptual)
RestaurantModule — tables, reservations, kitchen flow

RetailModule — barcode scanning, fast checkout

WarehouseModule — stock movements, inventory control

LoyaltyModule — loyalty points and rewards

Note: Service/module boundaries may currently be implemented directly inside server.js and will be progressively extracted into modules.

API Endpoints (High-Level)
This list is intentionally high-level. Refer to the backend route definitions for the authoritative API contract.

POST /auth/login — user login

POST /auth/logout — user logout

GET /api/health — health check

GET /restaurant/tables — table list

POST /restaurant/tables/:id/seat — seat guests / create order

GET /restaurant/reservations — reservation list

POST /orders — create order

GET /orders/:id — order details

POST /orders/:id/bill — generate bill

POST /payments — process payment

Web Interface
The web interface is served from the backend.

Usage
Open http://localhost:5000

Login with admin/admin123

Use tables/reservations/orders/payment flows as needed

Testing
Currently:

bash
Copy code
npm test
If tests are not yet implemented, replace the test script with a real test runner and add smoke/concurrency tests.

Data Integrity and Security
All critical mutations are transactional and idempotent.

Audit logs capture who/when/what changed, including old/new values and metadata.

Passwords hashed with bcrypt.

JWT authentication.

Security middleware includes Helmet and rate limiting.

Compliance and Localization
Configurable tax rules, invoice styles, currency, and language.

Designed to adapt to different fiscal requirements.

Contributing
Follow these standards:

prioritize correctness and auditability over convenience

keep business rules centralized (not in UI)

prefer small, testable functions

avoid destructive edits; preserve history

License
This project is licensed under the MIT License. See the LICENSE file for details.