-- Add RPC function to remove team members (allows MDs to remove users from organization)
-- This is more secure than direct UPDATE and allows us to add additional logic

CREATE OR REPLACE FUNCTION public.remove_team_member(member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_role text;
  current_user_org_id uuid;
  member_org_id uuid;
  member_role text;
  result jsonb;
BEGIN
  -- Get current user's role and organization
  SELECT role, organization_id INTO current_user_role, current_user_org_id
  FROM public.user_profiles
  WHERE id = auth.uid();
  
  -- Check if current user is MD or organizer
  IF current_user_role NOT IN ('managing_partner', 'organizer') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only managing partners and organizers can remove team members'
    );
  END IF;
  
  IF current_user_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must belong to an organization to remove team members'
    );
  END IF;
  
  -- Get member's organization and role
  SELECT organization_id, role INTO member_org_id, member_role
  FROM public.user_profiles
  WHERE id = member_id;
  
  -- Check if member exists
  IF member_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team member not found or already removed'
    );
  END IF;
  
  -- Check if member is in the same organization
  IF member_org_id != current_user_org_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team member is not in your organization'
    );
  END IF;
  
  -- Prevent removing other MDs/organizers (only allow removing team_member role)
  -- MDs can remove other MDs/organizers, but let's be explicit
  IF member_role IN ('managing_partner', 'organizer') AND current_user_role != 'managing_partner' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only managing partners can remove other administrators'
    );
  END IF;
  
  -- Prevent removing yourself
  IF member_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You cannot remove yourself from the organization'
    );
  END IF;
  
  -- Remove the member by setting organization_id to null
  UPDATE public.user_profiles
  SET organization_id = NULL
  WHERE id = member_id
  AND organization_id = current_user_org_id;
  
  -- Check if update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to remove team member'
    );
  END IF;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Team member removed successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.remove_team_member(uuid) IS 'Allows MDs/organizers to remove team members from their organization. Sets organization_id to NULL, which prevents them from accessing org data.';
