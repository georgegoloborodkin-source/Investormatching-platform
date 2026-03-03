-- Reflexion Memory: persistent agent learning across conversations.
-- Stores lessons, critique issues, blind spots from past Reflexion runs
-- so the agent improves over time (Sentra / NeurIPS 2023 Reflexion pattern).

CREATE TABLE IF NOT EXISTS public.reflexion_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  thread_id UUID,
  reflection_type TEXT NOT NULL CHECK (reflection_type IN (
    'critique_issue', 'blind_spot', 'missing_data', 'lesson', 'follow_up'
  )),
  content TEXT NOT NULL,
  company_name TEXT,
  topic TEXT,
  source_question TEXT,
  confidence FLOAT DEFAULT 0.8,
  used_count INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reflexion_memory_event ON public.reflexion_memory(event_id);
CREATE INDEX IF NOT EXISTS idx_reflexion_memory_thread ON public.reflexion_memory(thread_id);
CREATE INDEX IF NOT EXISTS idx_reflexion_memory_company ON public.reflexion_memory(company_name);
CREATE INDEX IF NOT EXISTS idx_reflexion_memory_type ON public.reflexion_memory(reflection_type);
CREATE INDEX IF NOT EXISTS idx_reflexion_memory_created ON public.reflexion_memory(created_at DESC);

ALTER TABLE public.reflexion_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reflexion memory" ON public.reflexion_memory;
DROP POLICY IF EXISTS "Members can manage reflexion memory" ON public.reflexion_memory;

CREATE POLICY "Members can view reflexion memory" ON public.reflexion_memory
  FOR SELECT USING (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Members can manage reflexion memory" ON public.reflexion_memory
  FOR ALL USING (
    event_id IN (SELECT id FROM public.events WHERE organization_id IN (
      SELECT organization_id FROM public.user_profiles WHERE id = auth.uid()
    ))
  );
