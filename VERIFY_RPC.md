# Verify RPC Function Exists

## Step 1: Check if RPC Function Exists

Run this in **Supabase SQL Editor**:

```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'ensure_user_organization';
```

**Expected:** Should return 1 row with the function definition.

**If 0 rows:** The RPC function doesn't exist. Run the migration below.

## Step 2: Create RPC Function (if missing)

Run this in **Supabase SQL Editor**:

```sql
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

## Step 3: Force Vercel Rebuild

1. Go to Vercel Dashboard
2. Find your project
3. Go to **Deployments** tab
4. Click **"..."** on the latest deployment
5. Click **"Redeploy"**
6. Wait for build to complete

## Step 4: Clear Browser Cache Completely

1. Open DevTools (F12)
2. Right-click the **refresh button** (next to address bar)
3. Select **"Empty Cache and Hard Reload"**
4. Or manually:
   - Press `Ctrl+Shift+Delete` (Windows) or `Cmd+Shift+Delete` (Mac)
   - Select "Cached images and files"
   - Time range: "All time"
   - Click "Clear data"

## Step 5: Verify in Network Tab

1. Open DevTools → **Network** tab
2. Log in with a new account
3. Look for these requests:
   - ✅ **GOOD:** `/rest/v1/rpc/ensure_user_organization` (should see this)
   - ❌ **BAD:** `/rest/v1/organizations?select=*` (should NOT see this)

If you still see the `/rest/v1/organizations` request, the old code is still running.
