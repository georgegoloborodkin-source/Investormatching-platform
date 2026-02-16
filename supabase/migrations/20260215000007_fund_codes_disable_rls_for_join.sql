-- Allow join_fund_by_code to find fund codes: disable RLS on fund_codes so the
-- SELECT inside the RPC (invoked by MD) can see the row. The code is not secret;
-- it is meant to be shared with the MD. We still filter by is_active in the RPC.

ALTER TABLE fund_codes DISABLE ROW LEVEL SECURITY;

-- Ensure authenticated can SELECT (needed for join_fund_by_code lookup)
GRANT SELECT ON fund_codes TO authenticated;
