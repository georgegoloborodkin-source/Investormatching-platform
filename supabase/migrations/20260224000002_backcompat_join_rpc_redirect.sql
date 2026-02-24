-- Backward compatibility for older frontend bundles still calling:
--   - join_fund_by_code
--   - join_org_by_invitation_code
--
-- Redirect both RPCs to the unified join_by_code logic.
-- This prevents 400 errors from stale clients while new clients use join_by_code directly.

CREATE OR REPLACE FUNCTION public.join_fund_by_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.join_by_code(code_param);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_org_by_invitation_code(code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.join_by_code(code_param);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_fund_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_org_by_invitation_code(text) TO authenticated;

COMMENT ON FUNCTION public.join_fund_by_code(text) IS 'Backward-compatible wrapper. Delegates to join_by_code.';
COMMENT ON FUNCTION public.join_org_by_invitation_code(text) IS 'Backward-compatible wrapper. Delegates to join_by_code.';
