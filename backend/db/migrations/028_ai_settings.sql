-- ====================================================================
-- 028: AI Settings — user-provided API keys for AI providers
-- ====================================================================
-- UP MIGRATION

CREATE TABLE IF NOT EXISTS ai_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  provider      VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'gemini', 'anthropic')),
  api_key_enc   TEXT NOT NULL,  -- encrypted with DATA_ENCRYPTION_KEY
  model         VARCHAR(100) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_user ON ai_settings(user_id);

-- DOWN MIGRATION
-- DROP TABLE IF EXISTS ai_settings;
