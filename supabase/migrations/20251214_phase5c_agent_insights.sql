-- Phase 5C: Chairman Daily Brief storage (audit)
-- Schema: prod

CREATE TABLE IF NOT EXISTS prod.agent_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  input_payload JSONB NOT NULL,
  final_output JSONB NOT NULL,
  html_render TEXT,
  text_render TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_insights_type_date
ON prod.agent_insights(type, as_of_date);

-- Optional uniqueness for daily brief IDs (safe to enable if you want strict idempotency)
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_insights_type_brief
-- ON prod.agent_insights(type, brief_id);
