-- Allow 'every_15_min' in sync_configurations.sync_frequency for Google Drive auto-sync.
-- Fixes: new row violates check constraint "sync_configurations_sync_frequency_check"

ALTER TABLE sync_configurations
  DROP CONSTRAINT IF EXISTS sync_configurations_sync_frequency_check;

ALTER TABLE sync_configurations
  ADD CONSTRAINT sync_configurations_sync_frequency_check
  CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual', 'on_login', 'every_15_min'));
