-- Ensure storage_path column exists in documents table

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
