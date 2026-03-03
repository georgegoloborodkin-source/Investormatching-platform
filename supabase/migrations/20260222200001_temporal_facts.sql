-- Temporal Facts: track how entity properties and KPIs change over time.
-- Each row = one observed fact at a point in time, enabling delta / "gamma" analysis.

CREATE TABLE IF NOT EXISTS public.temporal_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.kg_entities(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  fact_type TEXT NOT NULL CHECK (fact_type IN ('kpi', 'property', 'status', 'relationship')),
  field_name TEXT NOT NULL,
  value_numeric DOUBLE PRECISION,
  value_text TEXT,
  unit TEXT DEFAULT 'USD',
  period TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  source_description TEXT,
  previous_value_numeric DOUBLE PRECISION,
  previous_value_text TEXT,
  delta_absolute DOUBLE PRECISION,
  delta_percent DOUBLE PRECISION,
  acceleration DOUBLE PRECISION,
  confidence FLOAT DEFAULT 0.8,
  extraction_method TEXT DEFAULT 'claude_extraction',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporal Insights: non-obvious VC insights extracted by Claude.
-- Contradictions, trend shifts, hidden risks, commitments, red flags.
CREATE TABLE IF NOT EXISTS public.temporal_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES public.kg_entities(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'contradiction', 'trend_shift', 'hidden_risk', 'commitment', 'red_flag', 'non_obvious'
  )),
  field_name TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  previous_value TEXT,
  current_value TEXT,
  actionable_step TEXT,
  confidence FLOAT DEFAULT 0.8,
  source_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temporal_facts_event ON public.temporal_facts(event_id);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_entity ON public.temporal_facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_company ON public.temporal_facts(company_name, field_name);
CREATE INDEX IF NOT EXISTS idx_temporal_facts_observed ON public.temporal_facts(observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_temporal_insights_event ON public.temporal_insights(event_id);
CREATE INDEX IF NOT EXISTS idx_temporal_insights_company ON public.temporal_insights(company_name);
CREATE INDEX IF NOT EXISTS idx_temporal_insights_type ON public.temporal_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_temporal_insights_severity ON public.temporal_insights(severity);

ALTER TABLE public.temporal_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporal_insights ENABLE ROW LEVEL SECURITY;

-- RLS for temporal_facts
DROP POLICY IF EXISTS "Members can view temporal facts" ON public.temporal_facts;
DROP POLICY IF EXISTS "Members can create temporal facts" ON public.temporal_facts;
CREATE POLICY "Members can view temporal facts" ON public.temporal_facts
  FOR SELECT USING (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );
CREATE POLICY "Members can create temporal facts" ON public.temporal_facts
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );

-- RLS for temporal_insights
DROP POLICY IF EXISTS "Members can view temporal insights" ON public.temporal_insights;
DROP POLICY IF EXISTS "Members can manage temporal insights" ON public.temporal_insights;
CREATE POLICY "Members can view temporal insights" ON public.temporal_insights
  FOR SELECT USING (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );
CREATE POLICY "Members can manage temporal insights" ON public.temporal_insights
  FOR ALL USING (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );
