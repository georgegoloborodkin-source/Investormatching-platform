-- Structured KPI store: numbers, valuations, cap tables, metrics
-- Enables SQL-based queries like "revenue growth YoY" and "companies raising > $5M"

CREATE TABLE IF NOT EXISTS company_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  -- Which company/entity
  company_name TEXT NOT NULL,
  entity_id UUID REFERENCES kg_entities(id) ON DELETE SET NULL, -- optional link to graph
  
  -- The metric
  metric_name TEXT NOT NULL, -- e.g. "revenue", "arr", "mrr", "valuation", "burn_rate"
  metric_category TEXT DEFAULT 'financial' CHECK (metric_category IN (
    'financial',    -- revenue, profit, burn rate
    'growth',       -- MoM growth, YoY growth, user growth
    'fundraising',  -- round size, valuation, dilution
    'operational',  -- headcount, churn, NPS
    'market',       -- TAM, market share, competitor count
    'tokenomics',   -- token price, market cap, TVL (for crypto)
    'other'
  )),
  
  -- The value
  value DOUBLE PRECISION NOT NULL,
  unit TEXT DEFAULT 'USD', -- USD, %, count, ratio
  
  -- Time context
  period TEXT,              -- e.g. "2024-Q3", "2024", "2024-01"
  period_start DATE,
  period_end DATE,
  
  -- Provenance
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 0.8,
  extraction_method TEXT DEFAULT 'manual', -- manual, claude_extraction, structured_upload
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_kpis_event ON company_kpis(event_id);
CREATE INDEX IF NOT EXISTS idx_kpis_company ON company_kpis(company_name);
CREATE INDEX IF NOT EXISTS idx_kpis_metric ON company_kpis(metric_name);
CREATE INDEX IF NOT EXISTS idx_kpis_category ON company_kpis(metric_category);
CREATE INDEX IF NOT EXISTS idx_kpis_period ON company_kpis(period);
CREATE INDEX IF NOT EXISTS idx_kpis_document ON company_kpis(source_document_id);

-- RLS
ALTER TABLE company_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org KPIs"
  ON company_kpis FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = company_kpis.event_id
      )
    )
  );

CREATE POLICY "Users can manage KPIs"
  ON company_kpis FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('organizer', 'managing_partner')
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = company_kpis.event_id
      )
    )
  );

-- Helper: get all KPIs for a company
CREATE OR REPLACE FUNCTION get_company_kpis(
  target_company TEXT,
  filter_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
  metric_name TEXT,
  value DOUBLE PRECISION,
  unit TEXT,
  period TEXT,
  metric_category TEXT,
  confidence FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.metric_name,
    k.value,
    k.unit,
    k.period,
    k.metric_category,
    k.confidence
  FROM company_kpis k
  WHERE LOWER(k.company_name) = LOWER(TRIM(target_company))
    AND (filter_event_id IS NULL OR k.event_id = filter_event_id)
  ORDER BY k.period DESC, k.metric_name;
$$;

-- Helper: compare a metric across companies
CREATE OR REPLACE FUNCTION compare_metric(
  target_metric TEXT,
  filter_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
  company_name TEXT,
  value DOUBLE PRECISION,
  unit TEXT,
  period TEXT,
  confidence FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.company_name,
    k.value,
    k.unit,
    k.period,
    k.confidence
  FROM company_kpis k
  WHERE LOWER(k.metric_name) = LOWER(TRIM(target_metric))
    AND (filter_event_id IS NULL OR k.event_id = filter_event_id)
  ORDER BY k.value DESC;
$$;

-- Add contextual_header column to document_embeddings for storing enrichment headers
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS contextual_header TEXT;

-- Add RAG eval logging table
CREATE TABLE IF NOT EXISTS rag_eval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  
  question TEXT,
  retrieval_strategy TEXT,
  chunks_retrieved INT DEFAULT 0,
  chunks_cited INT DEFAULT 0,
  model_used TEXT,
  latency_ms FLOAT DEFAULT 0,
  user_feedback TEXT CHECK (user_feedback IS NULL OR user_feedback IN ('helpful', 'not_helpful')),
  
  -- Extra metadata
  entities_detected JSONB DEFAULT '[]',
  intent_classified TEXT,
  complexity_score FLOAT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_eval_event ON rag_eval_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_rag_eval_created ON rag_eval_logs(created_at);

ALTER TABLE rag_eval_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org eval logs"
  ON rag_eval_logs FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = rag_eval_logs.event_id
      )
    )
  );

CREATE POLICY "Users can insert eval logs"
  ON rag_eval_logs FOR INSERT
  WITH CHECK (created_by = auth.uid());
