-- PHASE 3: Execution Architecture Schema
-- All tables for Approval → Execute workflow
-- Run this migration in your Supabase project

-- 1. Approvals table (immutable log of all approval decisions)
CREATE TABLE IF NOT EXISTS prod.execution_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  total_decisions INT NOT NULL,
  total_recommendations INT NOT NULL,
  total_budget_delta DECIMAL(12, 2) NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approval_notes TEXT,
  safety_check_passed BOOLEAN DEFAULT FALSE,
  hard_cap_exceeded BOOLEAN DEFAULT FALSE,
  soft_cap_warning BOOLEAN DEFAULT FALSE,
  approval_payload JSONB,
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_successfully BOOLEAN DEFAULT FALSE,
  execution_error TEXT
);

-- 2. Execution logs (immutable record of all budget changes)
CREATE TABLE IF NOT EXISTS prod.execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approval_id UUID REFERENCES prod.execution_approvals(id),
  campaign_id BIGINT NOT NULL,
  campaign_name TEXT,
  old_budget DECIMAL(12, 2),
  new_budget DECIMAL(12, 2),
  budget_delta DECIMAL(12, 2),
  execution_status TEXT NOT NULL DEFAULT 'pending',
  google_ads_error TEXT,
  rollback_status TEXT,
  rollback_reason TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  rolled_back_at TIMESTAMP WITH TIME ZONE
);

-- 3. Safety caps configuration
CREATE TABLE IF NOT EXISTS prod.safety_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cap_name TEXT NOT NULL UNIQUE,
  cap_type TEXT NOT NULL,
  cap_value DECIMAL(12, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- 4. System control flags
CREATE TABLE IF NOT EXISTS prod.execution_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  control_name TEXT NOT NULL UNIQUE,
  control_value TEXT NOT NULL,
  updated_by TEXT,
  description TEXT
);

-- Insert default safety caps
INSERT INTO prod.safety_caps (cap_name, cap_type, cap_value, description, is_active)
VALUES
  ('max_single_budget_increase', 'percentage_change', 50, 'Max % increase for single campaign', TRUE),
  ('max_single_budget_decrease', 'percentage_change', 30, 'Max % decrease for single campaign', TRUE),
  ('max_daily_total_spend_change', 'hard_limit', 5000, 'Max total daily spend change in USD', TRUE),
  ('max_per_approval_delta', 'hard_limit', 10000, 'Max total budget delta per approval', TRUE),
  ('daily_spend_hard_ceiling', 'hard_limit', 50000, 'Absolute max daily spend across all campaigns', TRUE)
ON CONFLICT (cap_name) DO NOTHING;

-- Insert default controls
INSERT INTO prod.execution_controls (control_name, control_value, description)
VALUES
  ('pause_execution', 'false', 'When true, no executions allowed (kill switch)'),
  ('require_manual_approval', 'true', 'When true, all changes require human approval'),
  ('execution_email', 'ops@lixo.com', 'Email to notify on approval/execution events'),
  ('approval_timeout_hours', '24', 'Hours before pending approval expires'),
  ('rollback_window_hours', '24', 'Hours after execution to allow rollback')
ON CONFLICT (control_name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_execution_approvals_status ON prod.execution_approvals(approval_status);
CREATE INDEX IF NOT EXISTS idx_execution_approvals_created ON prod.execution_approvals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_approval_id ON prod.execution_logs(approval_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON prod.execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created ON prod.execution_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE prod.execution_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod.safety_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod.execution_controls ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can read/write (for automated jobs)
CREATE POLICY "service_role_execution" ON prod.execution_approvals
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_execution" ON prod.execution_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_safety" ON prod.safety_caps
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_control" ON prod.execution_controls
  FOR ALL USING (true) WITH CHECK (true);

-- Manual approval template (user runs this to approve)
-- UPDATE prod.execution_approvals
-- SET approval_status='approved',
--     approved_by='ops@lixo.in',
--     approved_at=now()
-- WHERE id='<approval_id>';
