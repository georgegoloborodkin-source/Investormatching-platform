-- Chat history tables for CIS

CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES chat_threads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT,
  source_doc_ids UUID[],
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_event_id ON chat_threads(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_event_id ON chat_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org chat threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can insert org chat threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can view org chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert org chat messages" ON chat_messages;

CREATE POLICY "Users can view org chat threads"
  ON chat_threads FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE e.id = chat_threads.event_id
      AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org chat threads"
  ON chat_threads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE e.id = chat_threads.event_id
      AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can view org chat messages"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE e.id = chat_messages.event_id
      AND up.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert org chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM events e
      JOIN user_profiles up ON up.organization_id = e.organization_id
      WHERE e.id = chat_messages.event_id
      AND up.id = auth.uid()
    )
  );
{
  "cells": [],
  "metadata": {
    "language_info": {
      "name": "python"
    }
  },
  "nbformat": 4,
  "nbformat_minor": 2
}