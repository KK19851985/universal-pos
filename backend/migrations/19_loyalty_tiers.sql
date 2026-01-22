-- Loyalty Tiers Implementation
-- Adds tier tracking to loyalty accounts and creates default fried chicken themed tiers

-- Add current_tier_id to loyalty_accounts if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'loyalty_accounts' AND column_name = 'current_tier_id') THEN
        ALTER TABLE loyalty_accounts ADD COLUMN current_tier_id INTEGER REFERENCES loyalty_tiers(id);
    END IF;
END $$;

-- Insert default fried chicken themed tiers (for organization 1)
-- First, get or create the default loyalty program
INSERT INTO loyalty_programs (organization_id, name, description, points_per_dollar, redemption_rate, minimum_redemption, is_active)
SELECT 1, 'Crispy Rewards', 'Earn points with every order!', 1.0, 0.01, 100, true
WHERE NOT EXISTS (SELECT 1 FROM loyalty_programs WHERE organization_id = 1 AND is_active = true);

-- Insert tiers for the program
INSERT INTO loyalty_tiers (program_id, name, description, minimum_points, multiplier, benefits, is_active)
SELECT 
    lp.id,
    '🍗 Nugget',
    'Welcome to the flock! Start earning crispy rewards.',
    0,
    1.00,
    '{"discount_percent": 0, "birthday_bonus": false, "priority_seating": false, "free_upgrades": false, "vip_treatment": false}'::jsonb,
    true
FROM loyalty_programs lp 
WHERE lp.organization_id = 1 AND lp.is_active = true
AND NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.program_id = lp.id AND lt.name LIKE '%Nugget%');

INSERT INTO loyalty_tiers (program_id, name, description, minimum_points, multiplier, benefits, is_active)
SELECT 
    lp.id,
    '🍗 Wing',
    'Spreading your wings! Enjoy bonus rewards.',
    500,
    1.25,
    '{"discount_percent": 5, "birthday_bonus": true, "priority_seating": false, "free_upgrades": false, "vip_treatment": false}'::jsonb,
    true
FROM loyalty_programs lp 
WHERE lp.organization_id = 1 AND lp.is_active = true
AND NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.program_id = lp.id AND lt.name LIKE '%Wing%');

INSERT INTO loyalty_tiers (program_id, name, description, minimum_points, multiplier, benefits, is_active)
SELECT 
    lp.id,
    '🍗 Drumstick',
    'A loyal drumstick! Premium perks unlocked.',
    2000,
    1.50,
    '{"discount_percent": 10, "birthday_bonus": true, "priority_seating": true, "free_upgrades": true, "vip_treatment": false}'::jsonb,
    true
FROM loyalty_programs lp 
WHERE lp.organization_id = 1 AND lp.is_active = true
AND NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.program_id = lp.id AND lt.name LIKE '%Drumstick%');

INSERT INTO loyalty_tiers (program_id, name, description, minimum_points, multiplier, benefits, is_active)
SELECT 
    lp.id,
    '🍗 Golden Crispy',
    'The crispiest of them all! Ultimate VIP status.',
    5000,
    2.00,
    '{"discount_percent": 15, "birthday_bonus": true, "priority_seating": true, "free_upgrades": true, "vip_treatment": true, "special_offers": true}'::jsonb,
    true
FROM loyalty_programs lp 
WHERE lp.organization_id = 1 AND lp.is_active = true
AND NOT EXISTS (SELECT 1 FROM loyalty_tiers lt WHERE lt.program_id = lp.id AND lt.name LIKE '%Golden Crispy%');

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tier ON loyalty_accounts(current_tier_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_min_points ON loyalty_tiers(program_id, minimum_points DESC);

-- Update existing accounts to have their correct tier based on total_points_earned
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
WHERE la.current_tier_id IS NULL;
