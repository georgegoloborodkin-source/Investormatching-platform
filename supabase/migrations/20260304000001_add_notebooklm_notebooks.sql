-- NotebookLM Integration: map events to Google NotebookLM notebooks
-- and track generated artifacts (audio, reports, quizzes, etc.)

CREATE TABLE IF NOT EXISTS notebooklm_notebooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  notebooklm_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sources_count INT DEFAULT 0,
  sources_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_event_notebook UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_nlm_notebooks_event ON notebooklm_notebooks(event_id);

CREATE TABLE IF NOT EXISTS notebooklm_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  notebook_mapping_id UUID NOT NULL REFERENCES notebooklm_notebooks(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'audio', 'video', 'report', 'quiz', 'flashcards',
    'mind_map', 'slide_deck', 'infographic', 'data_table'
  )),
  title TEXT,
  notebooklm_artifact_id TEXT,
  notebooklm_task_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'completed', 'failed'
  )),
  download_url TEXT,
  file_path TEXT,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nlm_artifacts_event ON notebooklm_artifacts(event_id);
CREATE INDEX IF NOT EXISTS idx_nlm_artifacts_notebook ON notebooklm_artifacts(notebook_mapping_id);
CREATE INDEX IF NOT EXISTS idx_nlm_artifacts_type ON notebooklm_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_nlm_artifacts_status ON notebooklm_artifacts(status);

-- RLS
ALTER TABLE notebooklm_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebooklm_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notebooklm notebooks" ON notebooklm_notebooks
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Members can manage notebooklm notebooks" ON notebooklm_notebooks
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Members can view notebooklm artifacts" ON notebooklm_artifacts
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );

CREATE POLICY "Members can manage notebooklm artifacts" ON notebooklm_artifacts
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    ))
  );
