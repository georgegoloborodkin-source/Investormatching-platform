-- =============================================================================
-- WIPE DATABASE — Run this in Supabase Dashboard → SQL Editor
-- =============================================================================
-- This script deletes ALL data from the project (public tables only).
-- Only truncates tables that exist (skips missing ones).
-- Auth users (sign-ins) are NOT deleted; only app data is wiped.
--
-- STORAGE: To empty cis-documents bucket use Dashboard → Storage → cis-documents
-- → select all files → Delete.
-- =============================================================================

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'api_usage_logs', 'rag_eval_logs', 'chat_messages', 'chat_threads',
    'document_embeddings', 'document_folder_links', 'documents',
    'company_connections', 'company_kpis', 'kg_edges', 'kg_entities',
    'email_attachments', 'email_threads', 'tasks', 'decisions',
    'sources', 'source_folders', 'sync_configurations', 'invitations',
    'removed_team_members', 'fund_codes', 'matches', 'mentors', 'corporates',
    'investors', 'startups', 'time_slots', 'events', 'user_profiles', 'organizations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', tbl);
    END IF;
  END LOOP;
END $$;

-- Done. All existing app tables have been truncated.
-- Auth users (auth.users) are unchanged.
