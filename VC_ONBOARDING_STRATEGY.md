# VC Onboarding Strategy

## Current State
- Users register via Google OAuth
- Auto-creates generic organization ("Default Organization" or user's name)
- Role selection (Managing Partner vs Team Member)
- No fund-specific information collected
- No way to distinguish between different VCs/funds

## Problem
**VCs need:**
1. **Fund identity** - Name, website, description, focus areas
2. **Team structure** - Clear hierarchy (Managing Partner → Team Members)
3. **Invitation system** - Managing Partners invite team members
4. **Fund settings** - Customizable preferences per fund

## Recommended Approach: **Hybrid Fund-First Onboarding**

### Flow 1: Managing Partner (First User)
```
1. Google OAuth → AuthCallback
2. Role Selection → Select "Managing Partner"
3. **NEW: Fund Setup Screen**
   - Fund name (required)
   - Fund website (optional)
   - Fund description (optional)
   - Focus sectors/stages (optional tags)
   - ClickUp integration (optional)
4. Create organization with fund name
5. Auto-create active event
6. Redirect to CIS dashboard
```

### Flow 2: Team Member (Invited)
```
1. Receives invitation link (email or shareable)
2. Clicks link → Google OAuth
3. Auto-joins existing fund (organization)
4. Role auto-set to "team_member"
5. Skip fund setup (already exists)
6. Redirect to CIS dashboard
```

### Flow 3: Team Member (Self-Register)
```
1. Google OAuth → AuthCallback
2. Role Selection → Select "Team Member"
3. **NEW: Join or Create Screen**
   - Option A: "Join existing fund" → Enter invitation code
   - Option B: "Create new fund" → Same as Flow 1
4. If joining: Validate code → Link to org
5. If creating: Create new org (becomes de facto Managing Partner)
6. Redirect to CIS dashboard
```

## Implementation Plan

### Phase 1: Fund Setup Screen (Managing Partner)
**File:** `src/pages/FundSetup.tsx` (new)

**Fields:**
- Fund Name* (text input)
- Fund Website (URL input)
- Fund Description (textarea)
- Focus Areas (multi-select tags: SaaS, FinTech, HealthTech, etc.)
- ClickUp Team ID (optional, pre-fill from RoleSelection if exists)

**Actions:**
- Create organization with fund name
- Update user profile with fund metadata
- Store fund settings in `organizations` table (add columns)

### Phase 2: Database Schema Updates
**Migration:** `20260127000003_add_fund_metadata.sql`

```sql
-- Add fund metadata to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS focus_areas TEXT[]; -- Array of tags
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clickup_team_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);
```

### Phase 3: Invitation System (Future)
**Migration:** `20260127000004_add_invitations.sql`

```sql
CREATE TABLE fund_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'team_member',
  invitation_code TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES user_profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invitations_code ON fund_invitations(invitation_code);
CREATE INDEX idx_invitations_email ON fund_invitations(email);
```

### Phase 4: Join or Create Screen (Team Member)
**File:** `src/pages/JoinOrCreateFund.tsx` (new)

**Options:**
1. **Join Fund** → Input invitation code → Validate → Link to org
2. **Create Fund** → Same form as FundSetup

## Recommended Order of Implementation

### ✅ Step 1: Fund Setup Screen (Managing Partner)
- Create `FundSetup.tsx`
- Update `RoleSelection.tsx` to redirect Managing Partners to fund setup
- Update `ensure_user_organization` RPC to accept fund metadata
- Add fund metadata columns to `organizations`

### ✅ Step 2: Update Organization Creation
- Modify `ensureOrganizationForUser` to accept fund details
- Store fund metadata during creation

### ✅ Step 3: Join or Create Screen (Team Member)
- Create `JoinOrCreateFund.tsx`
- Add invitation code validation
- Allow team members to create fund if no code provided

### ⏭️ Step 4: Invitation System (Later)
- Build invitation generation UI
- Email sending (or shareable links)
- Invitation code validation

## UI/UX Considerations

### Fund Setup Screen
- **Clean, professional design**
- **Progressive disclosure** - Required fields first, optional later
- **Validation** - Fund name must be unique (or allow duplicates?)
- **Skip option** - "Skip for now" → Use default name, can update later

### Join or Create Screen
- **Clear CTAs** - "Join Fund" vs "Create Fund"
- **Help text** - "Ask your Managing Partner for an invitation code"
- **Visual distinction** - Different colors/icons for each option

## Questions to Decide

1. **Fund name uniqueness?**
   - Allow duplicates? (Different VCs can have same name)
   - Or enforce uniqueness? (Require unique slug)

2. **Team member can create fund?**
   - Yes → Becomes Managing Partner automatically
   - No → Must be invited or contact support

3. **Invitation expiration?**
   - 7 days? 30 days? Never?

4. **Fund settings editable?**
   - Only Managing Partner?
   - Or all team members?

## Recommendation

**Start with Phase 1 (Fund Setup) only.**

**Why:**
- Solves immediate problem (generic org names)
- Low complexity
- Can add invitations later
- Team members can still create their own funds (becomes Managing Partner)

**Then add Phase 3 (Join or Create) if needed.**

**Invitations (Phase 4) can wait** - Not critical for MVP, adds complexity.
