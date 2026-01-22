# Restaurant Cycle Blueprint

## Overview
This document defines the complete restaurant operational cycle with strict state transitions,
ensuring data integrity, auditability, and prevention of impossible states per INSTRUCTION.md.

---

## 1. STATE MACHINES

### 1.1 Reservation States
```
┌─────────┐     book      ┌────────┐    confirm   ┌───────────┐
│  DRAFT  │──────────────▶│ BOOKED │─────────────▶│ CONFIRMED │
└─────────┘               └────────┘              └───────────┘
                               │                        │
                               │ cancel                 │ cancel
                               ▼                        ▼
                          ┌───────────┐           ┌───────────┐
                          │ CANCELLED │           │ CANCELLED │
                          └───────────┘           └───────────┘
                                                       │
                               ┌───────────────────────┤
                               │ checkin               │ no_show (time passed)
                               ▼                       ▼
                          ┌─────────┐            ┌─────────┐
                          │ ARRIVED │            │ NO_SHOW │
                          └─────────┘            └─────────┘
                               │
                               │ seat
                               ▼
                          ┌────────┐
                          │ SEATED │ (terminal for reservation)
                          └────────┘
```

**Allowed Transitions:**
| From       | To         | Trigger              | Guard                              |
|------------|------------|----------------------|------------------------------------|
| draft      | booked     | submit reservation   | valid date/time, party size > 0    |
| booked     | confirmed  | staff confirm        | none                               |
| booked     | cancelled  | guest/staff cancel   | none                               |
| confirmed  | arrived    | guest checks in      | within check-in window (±30min)   |
| confirmed  | cancelled  | cancel               | none                               |
| confirmed  | no_show    | auto after 30min     | past reservation time + grace     |
| arrived    | seated     | assign table + seat  | table must be available/reserved  |

**Forbidden:**
- Cannot go backwards (seated → arrived)
- Cannot seat without arrival
- Cannot mark no_show if already arrived

---

### 1.2 Table States
```
┌───────────┐   reserve    ┌──────────┐
│ AVAILABLE │─────────────▶│ RESERVED │
└───────────┘              └──────────┘
      ▲                          │
      │                          │ seat (with or without reservation)
      │                          ▼
      │                    ┌────────┐
      │◀───── clear ───────│ SEATED │
      │                    └────────┘
      │                          │
      │                          │ bill generated
      │                          ▼
      │                    ┌────────┐
      │                    │ BILLED │
      │                    └────────┘
      │                          │
      │                          │ payment complete
      │                          ▼
      │                    ┌────────────────┐
      │◀──── clear ────────│ NEEDS_CLEANING │
      │                    └────────────────┘
      │
      │   block/unblock
      ▼
┌─────────┐
│ BLOCKED │ (maintenance, reserved for VIP, etc.)
└─────────┘
```

**Allowed Transitions:**
| From            | To              | Trigger               | Guard                           |
|-----------------|-----------------|----------------------|----------------------------------|
| available       | reserved        | reservation confirm  | no active order on table         |
| available       | seated          | walk-in seat         | none                             |
| available       | blocked         | staff block          | none                             |
| reserved        | seated          | guest arrives + seat | matching reservation             |
| reserved        | available       | reservation cancel   | none                             |
| seated          | billed          | bill created         | order exists, items sent         |
| billed          | needs_cleaning  | payment complete     | full payment received            |
| needs_cleaning  | available       | staff clear          | none                             |
| blocked         | available       | staff unblock        | none                             |

**Forbidden:**
- Cannot seat a table that is already seated
- Cannot bill without items sent to kitchen
- Cannot clear table with unpaid balance

---

### 1.3 Order States
```
┌──────┐   add items   ┌───────────────┐   submit   ┌─────────────────┐
│ OPEN │──────────────▶│ ITEMS_PENDING │───────────▶│ SENT_TO_KITCHEN │
└──────┘               └───────────────┘            └─────────────────┘
                                                           │
                                                           │ all items ready/served
                                                           ▼
                                                    ┌────────┐
                                                    │ SERVED │
                                                    └────────┘
                                                           │
                                                           │ bill created
                                                           ▼
                                                    ┌────────┐
                                                    │ BILLED │
                                                    └────────┘
                                                           │
                                                           │ full payment
                                                           ▼
                                                    ┌──────┐
                                                    │ PAID │
                                                    └──────┘
                                                           │
                                                           │ close
                                                           ▼
                                                    ┌────────┐
                                                    │ CLOSED │ (terminal)
                                                    └────────┘
```

**Allowed Transitions:**
| From             | To               | Trigger              | Guard                          |
|------------------|------------------|----------------------|--------------------------------|
| open             | sent_to_kitchen  | submit to kitchen    | has items, idempotent          |
| sent_to_kitchen  | served           | all tickets ready    | auto when last item served     |
| served           | billed           | create bill          | idempotent                     |
| billed           | paid             | payment complete     | amount >= total, idempotent    |
| paid             | closed           | close order          | none                           |

**Forbidden:**
- Cannot submit empty order
- Cannot bill before kitchen submission
- Cannot close unpaid order

---

### 1.4 Kitchen Ticket/Item States
```
┌────────┐   send    ┌───────────┐   start    ┌────────────┐   complete   ┌───────┐
│ QUEUED │─────────▶│ PREPARING │──────────▶│   READY    │────────────▶│ SERVED│
└────────┘          └───────────┘            └────────────┘             └───────┘
     │                    │                        │
     │ void               │ void                   │ void (rare)
     ▼                    ▼                        ▼
┌────────┐          ┌────────┐               ┌────────┐
│ VOIDED │          │ VOIDED │               │ VOIDED │
└────────┘          └────────┘               └────────┘
```

**Allowed Transitions:**
| From      | To        | Trigger         | Guard                        |
|-----------|-----------|-----------------|------------------------------|
| queued    | preparing | kitchen start   | none                         |
| queued    | voided    | void item       | manager approval if started  |
| preparing | ready     | kitchen done    | none                         |
| preparing | voided    | void item       | requires manager approval    |
| ready     | served    | runner pickup   | none                         |
| ready     | voided    | void item       | requires manager approval    |

---

### 1.5 Payment States
```
┌─────────┐   process   ┌────────────┐
│ PENDING │────────────▶│ PROCESSING │
└─────────┘             └────────────┘
                              │
              ┌───────────────┼───────────────┐
              │ success       │ partial       │ fail
              ▼               ▼               ▼
        ┌──────────┐   ┌─────────┐      ┌────────┐
        │ COMPLETED│   │ PARTIAL │      │ FAILED │
        └──────────┘   └─────────┘      └────────┘
              │
              │ refund
              ▼
        ┌──────────┐
        │ REFUNDED │
        └──────────┘
```

---

## 2. WORKFLOW SEQUENCE

### Happy Path: Reservation → Close Table
```
1. CREATE RESERVATION     → reservation.status = 'booked'
2. CONFIRM RESERVATION    → reservation.status = 'confirmed', table.status = 'reserved'
3. GUEST ARRIVES          → reservation.status = 'arrived'
4. SEAT TABLE             → reservation.status = 'seated', table.status = 'seated', order created
5. ADD ORDER ITEMS        → order_items created
6. SUBMIT TO KITCHEN      → order.status = 'sent_to_kitchen', kitchen_tickets created (IDEMPOTENT)
7. KITCHEN PREPARES       → ticket.status = 'preparing'
8. KITCHEN READY          → ticket.status = 'ready'
9. SERVE ITEMS            → ticket.status = 'served', order.status = 'served' (when all done)
10. CREATE BILL           → order.status = 'billed', table.status = 'billed' (IDEMPOTENT)
11. PROCESS PAYMENT       → payment created, order.status = 'paid' (IDEMPOTENT)
12. CLOSE ORDER           → order.status = 'closed', table.status = 'needs_cleaning'
13. CLEAR TABLE           → table.status = 'available'
```

### Walk-in Path (No Reservation)
```
1. SEAT TABLE (walk-in)   → table.status = 'seated', order created
2-13. Same as above
```

---

## 3. IDEMPOTENCY REQUIREMENTS

Operations requiring idempotency keys:
- `POST /orders/:id/submit` (send to kitchen)
- `POST /orders/:id/bill` (create bill)
- `POST /payments` (process payment)
- `POST /payments/:id/refund` (refund)

Implementation:
1. Client generates UUID idempotency_key
2. Server checks `idempotency_keys` table
3. If key exists: return cached response
4. If new: execute, store result, return
5. Keys expire after 24 hours

---

## 4. AUDIT REQUIREMENTS

Every mutation must create an audit_events row:
```sql
INSERT INTO audit_events (
    user_id, device_id, action_type, entity_type, entity_id,
    old_values, new_values, idempotency_key, created_at
) VALUES (...);
```

Audit must capture:
- WHO: user_id (authenticated user)
- WHERE: device_id (terminal identifier)
- WHAT: action_type (e.g., 'order.submit_kitchen')
- WHICH: entity_type + entity_id
- CHANGE: old_values (JSON), new_values (JSON)
- WHEN: created_at (server timestamp)

---

## 5. CONCURRENCY GUARDS

### Double-Seat Prevention
```sql
-- Use SELECT FOR UPDATE when checking table status
BEGIN;
SELECT * FROM tables WHERE id = $1 FOR UPDATE;
-- Check status, proceed only if valid
UPDATE tables SET status = 'seated' WHERE id = $1 AND status IN ('available', 'reserved');
-- If rowcount = 0, another transaction won
COMMIT;
```

### Double-Payment Prevention
```sql
-- Use idempotency_key + order lock
BEGIN;
SELECT * FROM orders WHERE id = $1 FOR UPDATE;
-- Check if already paid
-- Process payment
COMMIT;
```

---

## 6. ERROR HANDLING

All errors must be:
1. Clearly communicated to staff (no silent failures)
2. Logged in audit_events with error details
3. Recoverable without data corruption

Categories:
- VALIDATION_ERROR: Invalid input, return 400
- CONFLICT_ERROR: State transition not allowed, return 409
- NOT_FOUND: Entity doesn't exist, return 404
- IDEMPOTENT_REPLAY: Return cached response, 200
- INTERNAL_ERROR: Log, return 500, operation fully rolled back
