-- Migration 16: Audit-Safe History Pattern
-- ============================================================================
-- This migration implements append-only history for table_statuses.
-- It replaces destructive DELETEs with soft-close updates using ended_at.
-- 
-- Auditability Rule: Real events must never be deleted from history tables.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add ended_at column for soft-closing status rows
-- ============================================================================

ALTER TABLE table_statuses ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP NULL;

-- ============================================================================
-- STEP 2: Drop the old unique index that required DELETEs
-- ============================================================================

DROP INDEX IF EXISTS idx_table_unique_active_seat;

-- ============================================================================
-- STEP 3: Create new partial unique index that uses ended_at
-- Only ONE active (ended_at IS NULL) seated row per table is allowed
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_table_unique_active_seat
ON table_statuses (table_id)
WHERE status = 'seated' AND ended_at IS NULL;

-- ============================================================================
-- STEP 4: Close out any existing seated rows that should have been ended
-- This handles legacy data - mark old seated rows as ended if a later status exists
-- ============================================================================

UPDATE table_statuses ts1
SET ended_at = (
    SELECT MIN(ts2.created_at)
    FROM table_statuses ts2
    WHERE ts2.table_id = ts1.table_id
    AND ts2.created_at > ts1.created_at
)
WHERE ts1.status = 'seated'
AND ts1.ended_at IS NULL
AND EXISTS (
    SELECT 1 FROM table_statuses ts3
    WHERE ts3.table_id = ts1.table_id
    AND ts3.created_at > ts1.created_at
);

-- ============================================================================
-- STEP 5: Add index for efficient queries on active statuses
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_table_statuses_active
ON table_statuses (table_id, created_at DESC)
WHERE ended_at IS NULL;

-- ============================================================================
-- STEP 6: Add comment explaining the pattern
-- ============================================================================

COMMENT ON COLUMN table_statuses.ended_at IS 
'Timestamp when this status was superseded by a new status. NULL means this is the current/active status row. Never DELETE history rows - set ended_at instead.';

