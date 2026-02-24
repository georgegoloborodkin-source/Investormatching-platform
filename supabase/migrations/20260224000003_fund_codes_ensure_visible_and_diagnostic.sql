-- Ensure fund_codes is readable by join_by_code (RLS off + grants).
-- Add a diagnostic RPC to verify a code exists from Supabase SQL Editor.

-- 1) RLS off and grants (idempotent)
ALTER TABLE fund_codes DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON fund_codes TO authenticated;
GRANT SELECT ON fund_codes TO service_role;

-- 2) Diagnostic: call from SQL Editor to see if a code exists (e.g. SELECT * FROM check_fund_code('FUND-9833');)
CREATE OR REPLACE FUNCTION public.check_fund_code(code_in text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_norm text;
  r record;
BEGIN
  code_norm := UPPER(TRIM(code_in));
  IF code_norm = '' THEN
    RETURN jsonb_build_object('found', false, 'error', 'empty code');
  END IF;
  SELECT id, code, TRIM(code) AS code_trimmed, is_active, used_at
  INTO r
  FROM fund_codes
  WHERE TRIM(code) = code_norm;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'code_checked', code_norm,
      'hint', 'Run: SELECT id, code, is_active FROM fund_codes; to list all codes.'
    );
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'code', r.code,
    'code_trimmed', r.code_trimmed,
    'is_active', r.is_active,
    'used_at', r.used_at
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_fund_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_fund_code(text) TO service_role;

COMMENT ON FUNCTION public.check_fund_code(text) IS 'Diagnostic: returns whether a fund code exists and is active. Use from SQL Editor to debug join_by_code 400.';

-- If you still get "Invalid or inactive code" after this migration:
-- 1. In Supabase SQL Editor run:   SELECT * FROM check_fund_code('FUND-9833');
--    If found=false, the code is missing: create it in Admin panel or insert into fund_codes.
-- 2. List all codes:   SELECT id, code, is_active, used_at FROM fund_codes ORDER BY created_at DESC;
-- 3. Ensure RLS is off:   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'fund_codes';
--    relrowsecurity should be false.
