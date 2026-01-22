-- Loyalty Program Module Migration

-- Loyalty Programs (extended from CRM)
CREATE TABLE loyalty_tiers (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES loyalty_programs(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    minimum_points INTEGER NOT NULL,
    multiplier DECIMAL(3,2) DEFAULT 1.0, -- points multiplier
    benefits JSONB, -- tier-specific benefits
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty Rules
CREATE TABLE loyalty_rules (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES loyalty_programs(id),
    rule_type VARCHAR(50) NOT NULL, -- earn_points, redeem_points, bonus_multiplier
    trigger_event VARCHAR(50) NOT NULL, -- order_complete, referral, birthday, etc.
    conditions JSONB, -- rule conditions
    actions JSONB, -- rule actions (points to award, etc.)
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Loyalty Campaigns
CREATE TABLE loyalty_campaigns (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL, -- points_bonus, referral, milestone
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    conditions JSONB,
    rewards JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Milestones
CREATE TABLE customer_milestones (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    milestone_type VARCHAR(50) NOT NULL, -- visits, spend, points_earned
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    achieved_at TIMESTAMP,
    reward_claimed BOOLEAN DEFAULT false,
    reward_claimed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Referral Program
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES customers(id),
    referee_email VARCHAR(255) NOT NULL,
    referee_name VARCHAR(255),
    referral_code VARCHAR(100) UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, signed_up, first_purchase, rewarded
    referee_id INTEGER REFERENCES customers(id), -- filled when referee signs up
    reward_issued BOOLEAN DEFAULT false,
    reward_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Loyalty Rewards Catalog
CREATE TABLE loyalty_rewards (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES loyalty_programs(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) NOT NULL, -- discount, free_item, upgrade, experience
    points_required INTEGER NOT NULL,
    value DECIMAL(10,2), -- monetary value or discount amount
    is_limited BOOLEAN DEFAULT false,
    available_quantity INTEGER,
    redemption_limit INTEGER, -- per customer
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reward Redemptions
CREATE TABLE reward_redemptions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    reward_id INTEGER REFERENCES loyalty_rewards(id),
    points_used INTEGER NOT NULL,
    redemption_value DECIMAL(10,2),
    order_id INTEGER REFERENCES orders(id), -- if redeemed during purchase
    status VARCHAR(20) DEFAULT 'redeemed', -- redeemed, used, expired, cancelled
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    expiry_date TIMESTAMP
);

-- Loyalty Analytics
CREATE TABLE loyalty_analytics (
    id SERIAL PRIMARY KEY,
    program_id INTEGER REFERENCES loyalty_programs(id),
    date DATE NOT NULL,
    new_members INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    redemptions_count INTEGER DEFAULT 0,
    average_points_per_member DECIMAL(10,2) DEFAULT 0,
    churn_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(program_id, date)
);

-- Indexes
CREATE INDEX idx_loyalty_tiers_program ON loyalty_tiers(program_id);
CREATE INDEX idx_loyalty_rules_program ON loyalty_rules(program_id);
CREATE INDEX idx_loyalty_campaigns_org ON loyalty_campaigns(organization_id);
CREATE INDEX idx_customer_milestones_customer ON customer_milestones(customer_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_loyalty_rewards_program ON loyalty_rewards(program_id);
CREATE INDEX idx_reward_redemptions_customer ON reward_redemptions(customer_id);
CREATE INDEX idx_reward_redemptions_reward ON reward_redemptions(reward_id);
CREATE INDEX idx_loyalty_analytics_program ON loyalty_analytics(program_id);
CREATE INDEX idx_loyalty_analytics_date ON loyalty_analytics(date);

-- Constraints
ALTER TABLE loyalty_tiers ADD CONSTRAINT chk_minimum_points CHECK (minimum_points >= 0);
ALTER TABLE loyalty_rules ADD CONSTRAINT chk_priority CHECK (priority >= 1);
ALTER TABLE customer_milestones ADD CONSTRAINT chk_current_value CHECK (current_value >= 0);
ALTER TABLE reward_redemptions ADD CONSTRAINT chk_points_used CHECK (points_used > 0);