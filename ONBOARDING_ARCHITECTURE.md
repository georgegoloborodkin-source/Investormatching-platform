# VC Fund Onboarding & Authentication Architecture

## Overview

This document outlines the recommended architecture for onboarding VC funds and managing user roles (MD vs Investment Team Members) in the platform.

## Current State

**What exists:**
- Supabase authentication (email/password, OAuth)
- User profiles with `organization_id` and `role` fields
- Row Level Security (RLS) policies for organization-level access
- Basic organization creation via `ensure_user_organization` RPC

**What's missing:**
- Structured onboarding flow for VC funds
- Role-based access control (MD vs Investment Team)
- Invitation system for team members
- Organization settings/management UI

---

## Recommended Architecture

### 1. Database Schema Enhancements

#### Organizations Table (Enhanced)
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  fund_type TEXT CHECK (fund_type IN ('vc', 'angel', 'syndicate', 'family_office')),
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
```

#### User Profiles Table (Enhanced)
```sql
-- Add role enum
CREATE TYPE user_role AS ENUM ('md', 'partner', 'principal', 'associate', 'analyst', 'admin');

-- Enhance user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'analyst';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES user_profiles(id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invitation_token TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;
```

#### Invitations Table (New)
```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES user_profiles(id),
  email TEXT NOT NULL,
  role user_role NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_pending_invitation UNIQUE (organization_id, email, accepted_at)
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_organization ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
```

---

### 2. Onboarding Flow

#### Flow 1: MD/Founder Onboarding (First User)

**Step 1: Registration**
- User signs up with email/password or OAuth
- System creates user profile
- User is prompted: "Are you creating a new fund or joining an existing one?"

**Step 2: Fund Creation**
- If "creating new fund":
  - Form: Fund name, type (VC/Angel/Syndicate), website
  - System creates organization
  - User is assigned `role: 'md'` or `role: 'admin'`
  - User is linked to organization
  - System creates default event
  - Redirect to onboarding completion

**Step 3: Onboarding Completion**
- Welcome screen with quick tour
- Prompt to invite team members
- Option to skip and do later

#### Flow 2: Team Member Onboarding (Invited User)

**Step 1: Invitation**
- MD/Admin sends invitation via email
- System generates invitation token (UUID)
- Invitation stored in `invitations` table
- Email sent with invitation link: `https://app.com/invite/{token}`

**Step 2: Invitation Acceptance**
- User clicks invitation link
- System validates token (not expired, not used)
- If user doesn't exist:
  - Show signup form (pre-filled email)
  - Create account
- If user exists:
  - Show "Accept invitation" button
- User accepts → linked to organization with specified role
- Invitation marked as accepted
- Redirect to platform

**Step 3: Role Assignment**
- Role assigned based on invitation: `md`, `partner`, `principal`, `associate`, `analyst`
- RLS policies enforce role-based access

---

### 3. Role-Based Access Control (RBAC)

#### Role Hierarchy
```
md/admin (Highest)
  ├── Full access to all features
  ├── Can invite/manage team members
  ├── Can manage organization settings
  └── Can delete organization

partner
  ├── Can log decisions
  ├── Can view all decisions
  ├── Can invite analysts/associates
  └── Cannot manage organization settings

principal
  ├── Can log decisions
  ├── Can view all decisions
  └── Cannot invite team members

associate
  ├── Can log decisions
  ├── Can view own decisions + team decisions
  └── Cannot invite team members

analyst (Lowest)
  ├── Can view decisions (read-only)
  ├── Can upload documents
  └── Cannot log decisions
```

#### RLS Policy Examples

```sql
-- Decisions: MD/Partner/Principal can insert, all can view
CREATE POLICY "Decisions insert by role"
  ON decisions FOR INSERT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = decisions.event_id
      )
      AND user_profiles.role IN ('md', 'admin', 'partner', 'principal', 'associate')
    )
  );

-- Organization settings: Only MD/Admin can update
CREATE POLICY "Organizations update by role"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.organization_id = organizations.id
      AND user_profiles.role IN ('md', 'admin')
    )
  );
```

---

### 4. Frontend Components

#### Onboarding Components Needed

1. **FundCreationForm**
   - Fund name input
   - Fund type selector (VC/Angel/Syndicate)
   - Website input (optional)
   - Logo upload (optional)

2. **InvitationForm**
   - Email input
   - Role selector (partner/principal/associate/analyst)
   - Message (optional)
   - Send invitation button

3. **InvitationAcceptance**
   - Display invitation details (fund name, role)
   - Accept/Decline buttons
   - Signup form (if user doesn't exist)

4. **TeamManagement**
   - List of team members
   - Role badges
   - Invite new member button
   - Remove member (MD only)
   - Change role (MD only)

5. **OrganizationSettings**
   - Fund name/type editing
   - Logo upload
   - Team management link
   - Delete organization (MD only)

---

### 5. API Endpoints Needed

#### Backend Endpoints (Supabase RPCs)

```sql
-- Create organization and assign MD
CREATE OR REPLACE FUNCTION create_fund_with_md(
  fund_name TEXT,
  fund_type TEXT,
  fund_website TEXT DEFAULT NULL,
  md_user_id UUID
) RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Create organization
  INSERT INTO organizations (name, slug, fund_type, website)
  VALUES (fund_name, slugify(fund_name), fund_type, fund_website)
  RETURNING id INTO org_id;
  
  -- Assign MD role
  UPDATE user_profiles
  SET organization_id = org_id, role = 'md', onboarded_at = NOW()
  WHERE id = md_user_id;
  
  -- Create default event
  INSERT INTO events (organization_id, name, status)
  VALUES (org_id, 'Main Event', 'active');
  
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send invitation
CREATE OR REPLACE FUNCTION send_invitation(
  invitee_email TEXT,
  invitee_role user_role,
  message TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  inv_token TEXT;
  org_id UUID;
  inviter_id UUID;
BEGIN
  -- Get current user's org
  SELECT organization_id, id INTO org_id, inviter_id
  FROM user_profiles
  WHERE id = auth.uid();
  
  -- Check permissions (MD/Partner can invite)
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('md', 'admin', 'partner')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to send invitations';
  END IF;
  
  -- Generate token
  inv_token := gen_random_uuid()::TEXT;
  
  -- Create invitation
  INSERT INTO invitations (organization_id, invited_by, email, role, token, expires_at)
  VALUES (org_id, inviter_id, invitee_email, invitee_role, inv_token, NOW() + INTERVAL '7 days');
  
  -- TODO: Send email (via Supabase Edge Function or external service)
  
  RETURN inv_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  invitation_token TEXT
) RETURNS UUID AS $$
DECLARE
  inv_record RECORD;
  org_id UUID;
BEGIN
  -- Get invitation
  SELECT * INTO inv_record
  FROM invitations
  WHERE token = invitation_token
  AND expires_at > NOW()
  AND accepted_at IS NULL;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Link user to organization
  UPDATE user_profiles
  SET organization_id = inv_record.organization_id,
      role = inv_record.role,
      invited_by = inv_record.invited_by,
      onboarded_at = NOW()
  WHERE id = auth.uid();
  
  -- Mark invitation as accepted
  UPDATE invitations
  SET accepted_at = NOW()
  WHERE id = inv_record.id;
  
  RETURN inv_record.organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 6. Implementation Priority

#### Phase 1: Basic Onboarding (Week 1-2)
- [ ] Enhance `organizations` table with fund_type, website, logo
- [ ] Add `role` enum and column to `user_profiles`
- [ ] Create `create_fund_with_md` RPC
- [ ] Build FundCreationForm component
- [ ] Update signup flow to include fund creation

#### Phase 2: Invitation System (Week 3-4)
- [ ] Create `invitations` table
- [ ] Create `send_invitation` RPC
- [ ] Create `accept_invitation` RPC
- [ ] Build InvitationForm component
- [ ] Build InvitationAcceptance component
- [ ] Add email sending (Supabase Edge Function or SendGrid)

#### Phase 3: Role-Based Access (Week 5-6)
- [ ] Update RLS policies for role-based access
- [ ] Build TeamManagement component
- [ ] Build OrganizationSettings component
- [ ] Add role badges throughout UI
- [ ] Add role-based feature flags

#### Phase 4: Polish (Week 7-8)
- [ ] Onboarding tour/walkthrough
- [ ] Email templates for invitations
- [ ] Analytics for onboarding funnel
- [ ] Documentation for MDs on team management

---

### 7. Security Considerations

1. **Invitation Tokens**
   - Use cryptographically secure UUIDs
   - Expire after 7 days
   - Single-use (mark as accepted)
   - Rate limit invitation sending (prevent spam)

2. **Role Escalation Prevention**
   - Only MD/Admin can change roles
   - Cannot self-promote to MD
   - Audit log for role changes

3. **Organization Isolation**
   - RLS ensures users only see their org's data
   - No cross-organization access
   - Organization deletion requires MD confirmation

4. **Invitation Abuse Prevention**
   - Rate limit: Max 10 invitations/day per user
   - Email validation
   - Block known spam domains

---

### 8. User Experience Flow

#### MD Onboarding Journey
```
1. Sign up → "Create new fund" → Fill fund details → Fund created
2. Welcome screen → "Invite your team" → Send invitations
3. Access platform → See empty dashboard → Start logging decisions
```

#### Team Member Journey
```
1. Receive invitation email → Click link → Sign up (if needed) → Accept invitation
2. Welcome screen → "You've joined [Fund Name]" → Access platform
3. See team's decisions → Start contributing
```

---

### 9. Migration Strategy

**For existing users:**
- Existing users without `role` → Default to `analyst`
- Existing organizations → Add `fund_type: 'vc'` by default
- Existing users → Mark as `onboarded_at: created_at`

**Migration SQL:**
```sql
-- Set default roles
UPDATE user_profiles
SET role = 'analyst'
WHERE role IS NULL;

-- Set default fund types
UPDATE organizations
SET fund_type = 'vc'
WHERE fund_type IS NULL;

-- Mark existing users as onboarded
UPDATE user_profiles
SET onboarded_at = created_at
WHERE onboarded_at IS NULL;
```

---

## Summary

**Key Components:**
1. Enhanced database schema (organizations, user_profiles, invitations)
2. Role-based access control (MD/Partner/Principal/Associate/Analyst)
3. Invitation system (email-based, token-based)
4. Onboarding flows (MD creation, team member invitation)
5. Team management UI (invite, manage roles, remove members)

**Timeline:** 8 weeks for full implementation
**Priority:** Phase 1 (Basic Onboarding) is critical for alpha demo

This architecture provides a solid foundation for VC fund onboarding while maintaining security and scalability.
