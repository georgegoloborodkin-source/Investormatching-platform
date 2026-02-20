-- API Cost Tracking: track Anthropic (Claude) API usage for unit economics
-- Enables visibility into which features/endpoints consume the most tokens/cost.

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- API details
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'voyage', 'cohere')),
  model TEXT NOT NULL,
  endpoint TEXT NOT NULL, -- e.g., '/ask/stream', '/convert', '/extract-entities'
  
  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  
  -- Cost estimation (in USD, calculated from provider pricing)
  estimated_cost_usd DECIMAL(10, 6) DEFAULT 0,
  
  -- Request metadata
  request_id TEXT, -- Optional: external request ID from provider
  error_message TEXT, -- If request failed
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT valid_tokens CHECK (total_tokens = input_tokens + output_tokens)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_org ON api_usage_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_event ON api_usage_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_logs(endpoint, created_at DESC);

-- RLS: users can only see logs for their organization
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view API usage logs for their org"
  ON api_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.organization_id = api_usage_logs.organization_id
    )
  );

CREATE POLICY "Service role can insert API usage logs"
  ON api_usage_logs FOR INSERT
  WITH CHECK (true); -- Backend inserts via service role

-- Helper view: daily cost summary by organization
CREATE OR REPLACE VIEW api_usage_daily_summary AS
SELECT
  organization_id,
  DATE(created_at) AS usage_date,
  provider,
  endpoint,
  COUNT(*) AS request_count,
  SUM(input_tokens) AS total_input_tokens,
  SUM(output_tokens) AS total_output_tokens,
  SUM(total_tokens) AS total_tokens,
  SUM(estimated_cost_usd) AS total_cost_usd,
  AVG(estimated_cost_usd) AS avg_cost_per_request
FROM api_usage_logs
GROUP BY organization_id, DATE(created_at), provider, endpoint;

-- Helper function: get monthly cost for an organization
CREATE OR REPLACE FUNCTION get_monthly_api_cost(p_org_id UUID, p_month DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider TEXT,
  total_cost_usd DECIMAL(10, 6),
  total_requests BIGINT,
  total_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    aul.provider,
    SUM(aul.estimated_cost_usd)::DECIMAL(10, 6) AS total_cost_usd,
    COUNT(*)::BIGINT AS total_requests,
    SUM(aul.total_tokens)::BIGINT AS total_tokens
  FROM api_usage_logs aul
  WHERE aul.organization_id = p_org_id
    AND DATE_TRUNC('month', aul.created_at) = DATE_TRUNC('month', p_month)
  GROUP BY aul.provider
  ORDER BY total_cost_usd DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
