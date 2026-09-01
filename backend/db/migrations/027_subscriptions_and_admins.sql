-- ====================================================================
-- 027: Subscriptions, Admins, and Feature Flags
-- ====================================================================
-- UP MIGRATION

-- 1. Add role column to parents (parent | admin)
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'parent'
    CHECK (role IN ('parent', 'admin'));

-- 2. Add subscription columns to parents
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) NOT NULL DEFAULT 'TRIAL'
    CHECK (subscription_tier IN ('FREE', 'TRIAL', 'PREMIUM'));

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ
    DEFAULT (now() + INTERVAL '7 days');

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ;

-- Set trial_expires_at for existing users who are currently in TRIAL
UPDATE parents
  SET trial_expires_at = (created_at + INTERVAL '7 days')
  WHERE subscription_tier = 'TRIAL' AND trial_expires_at IS NULL;

-- 3. Feature flags table — admin-controlled per-tier feature gates
CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(100) UNIQUE NOT NULL,       -- e.g. 'location_tracking'
  description   TEXT,
  is_enabled    BOOLEAN NOT NULL DEFAULT true,       -- global kill switch
  required_tier VARCHAR(50) NOT NULL DEFAULT 'FREE' -- 'FREE' | 'TRIAL' | 'PREMIUM'
    CHECK (required_tier IN ('FREE', 'TRIAL', 'PREMIUM')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_feature_flags_modtime
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Seed default feature flags — FREE features are available to all
INSERT INTO feature_flags (key, description, is_enabled, required_tier) VALUES
  ('app_blocking',          'Block / unblock apps on the child device',         true, 'FREE'),
  ('screen_time_basic',     'Basic daily screen time limit enforcement',         true, 'FREE'),
  ('sos_button',            'Child SOS emergency button',                        true, 'FREE'),
  ('mood_tracking',         'Child daily mood logging',                          true, 'FREE'),
  ('location_tracking',     'Real-time GPS location tracking',                   true, 'TRIAL'),
  ('geofencing',            'Safe-zone entry/exit alerts',                       true, 'TRIAL'),
  ('screen_time_advanced',  'Detailed per-app usage reports and history',        true, 'TRIAL'),
  ('communication_monitor', 'Call and SMS contact filtering',                    true, 'TRIAL'),
  ('url_filtering',         'Block or allow specific websites',                  true, 'TRIAL'),
  ('behavior_predictions',  'AI-powered risk and behavior predictions',          true, 'PREMIUM'),
  ('selfharm_detection',    'Self-harm keyword and pattern alerts',              true, 'PREMIUM'),
  ('weekly_ai_reports',     'AI-generated weekly child wellness summaries',      true, 'PREMIUM'),
  ('multi_guardian',        'Add co-parent or second guardian to an account',   true, 'PREMIUM')
ON CONFLICT (key) DO NOTHING;

-- 4. Subscription payments ledger (records payment events from any gateway)
CREATE TABLE IF NOT EXISTS subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  gateway         VARCHAR(30) NOT NULL CHECK (gateway IN ('stripe', 'razorpay', 'google_play')),
  gateway_event   VARCHAR(100),                -- e.g. 'payment_intent.succeeded'
  gateway_ref     VARCHAR(255),               -- Stripe PI ID / Razorpay order ID / GP token
  amount_minor    INTEGER,                    -- Amount in minor currency units (e.g. paise, cents)
  currency        VARCHAR(3),                 -- ISO 4217
  tier_granted    VARCHAR(50) NOT NULL CHECK (tier_granted IN ('TRIAL', 'PREMIUM')),
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  raw_payload     JSONB,                      -- Full webhook body for debugging
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_payments_parent ON subscription_payments(parent_id);
CREATE INDEX idx_subscription_payments_gateway_ref ON subscription_payments(gateway_ref);

-- ====================================================================
-- DOWN MIGRATION
-- ====================================================================
/*
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
ALTER TABLE parents DROP COLUMN IF EXISTS subscription_updated_at;
ALTER TABLE parents DROP COLUMN IF EXISTS trial_expires_at;
ALTER TABLE parents DROP COLUMN IF EXISTS subscription_tier;
ALTER TABLE parents DROP COLUMN IF EXISTS role;
*/
