ALTER TABLE IF EXISTS prod.execution_logs
  ADD COLUMN IF NOT EXISTS campaign_budget_resource_name TEXT;

CREATE INDEX IF NOT EXISTS idx_execution_logs_budget_resource
ON prod.execution_logs(campaign_budget_resource_name);
