-- Add category column to source_folders for organizing folders into
-- Sourcing, Portfolio Companies, Funds, BD, Mentors/Corporates/Organizations
ALTER TABLE source_folders ADD COLUMN IF NOT EXISTS category text DEFAULT 'Portfolio Companies';

-- Backfill existing folders with sensible defaults based on name
UPDATE source_folders SET category = 'Sourcing' WHERE lower(name) IN ('sourcing', 'deals', 'market research');
UPDATE source_folders SET category = 'Funds' WHERE lower(name) IN ('funds', 'investors');
UPDATE source_folders SET category = 'Portfolio Companies' WHERE lower(name) IN ('portfolio companies', 'due diligence');
UPDATE source_folders SET category = 'Mentors / Corporates' WHERE lower(name) IN ('mentors', 'corporates', 'organizations');
