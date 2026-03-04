-- Studio Content Generation: self-hosted artifacts using RAG + Claude
-- No external dependency (NotebookLM not required)

CREATE TABLE IF NOT EXISTS studio_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'report', 'quiz', 'flashcards', 'mind_map',
    'audio_script', 'slide_deck', 'data_table'
  )),
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN (
    'generating', 'completed', 'failed'
  )),
  content TEXT DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (content_format IN (
    'markdown', 'json', 'csv', 'html'
  )),
  instructions TEXT DEFAULT '',
  source_doc_count INT DEFAULT 0,
  token_cost JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_artifacts_event ON studio_artifacts(event_id);
CREATE INDEX IF NOT EXISTS idx_studio_artifacts_type ON studio_artifacts(artifact_type);

ALTER TABLE studio_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view studio artifacts" ON studio_artifacts
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Members can manage studio artifacts" ON studio_artifacts
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );
