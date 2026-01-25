# Fix Organization RLS Error - Step by Step

## The Problem
The frontend is still trying to INSERT directly into `organizations` table, which is blocked by RLS.

## Solution: Use RPC Function

### Step 1: Create RPC Function in Supabase

Run this SQL in **Supabase SQL Editor**:

```sql
-- Create RPC to safely create and link an organization for a user
CREATE OR REPLACE FUNCTION public.ensure_user_organization(org_name text, org_slug text)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_org_id uuid;
  created_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT organization_id INTO existing_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF existing_org_id IS NOT NULL THEN
    SELECT * INTO created_org
    FROM public.organizations
    WHERE id = existing_org_id;
    RETURN created_org;
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING * INTO created_org;

  UPDATE public.user_profiles
  SET organization_id = created_org.id
  WHERE id = auth.uid();

  RETURN created_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_organization(text, text) TO authenticated;
```

### Step 2: Verify RPC Exists

Run this to check:
```sql
SELECT proname FROM pg_proc WHERE proname = 'ensure_user_organization';
```

Should return 1 row.

### Step 3: Clear Browser Cache

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

### Step 4: Wait for Vercel Deployment

1. Check Vercel dashboard - latest commit should be deployed
2. The build should show the RPC code is being used
3. Check Network tab - should see `/rest/v1/rpc/ensure_user_organization` NOT `/rest/v1/organizations`

### Step 5: Test

1. Log out completely
2. Log in with a new account
3. Check browser console - should NOT see 403 error
4. Check Network tab - should see RPC call, not direct INSERT

## If Still Failing

Check browser console for the exact error. If you see:
- `function "ensure_user_organization" does not exist` → RPC not created (run Step 1)
- `403 Forbidden` on `/rest/v1/organizations` → Old code still running (clear cache, wait for deploy)
- `permission denied` → RLS issue (check RPC has SECURITY DEFINER)
