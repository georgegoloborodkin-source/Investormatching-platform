# Supabase Setup Guide: Authentication & User Roles

## 🎯 Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click **"Start your project"** or **"Sign up"**
3. Sign up with **Google** (recommended) or email
4. Create a new project:
   - **Name**: `investor-matching-platform` (or your choice)
   - **Database Password**: Save this! (you'll need it)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for MVP

## 🔐 Step 2: Enable Google OAuth

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** and toggle it **ON**
3. You'll need Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use existing)
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: 
     ```
     https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
     ```
     (Find YOUR_PROJECT_REF in Supabase Dashboard → Settings → API)
   - Copy **Client ID** and **Client Secret**
4. Paste into Supabase Google provider settings
5. Save

## 👥 Step 3: User Role System Design

### User Types (Roles):
**Simplified 2-role system:**

1. **Organizer** - Admin with full access
   - Creates/manages events
   - Adds investors & startups
   - Generates matches
   - Views all data in organization
   - Can override investor availability

2. **Investor** - VC team member (participant)
   - Views own schedule
   - Sets time slot availability
   - Updates own profile
   - Cannot see other investors' data

**Note:** Startups are data entries (no login required). If needed, we can add a "startup" role later.

### Database Schema:

```sql
-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('organizer', 'investor')),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Organizations (VC firms, accelerators)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events (multiple events per organization)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Investors (linked to user_profiles)
CREATE TABLE investors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id), -- NULL if added by organizer
  firm_name TEXT NOT NULL,
  member_name TEXT NOT NULL,
  geo_focus TEXT[],
  industry_preferences TEXT[],
  stage_preferences TEXT[],
  min_ticket_size BIGINT,
  max_ticket_size BIGINT,
  total_slots INTEGER,
  table_number TEXT,
  availability_status TEXT DEFAULT 'present',
  slot_availability JSONB, -- {"slot_1": true, "slot_2": false, ...}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Startups
CREATE TABLE startups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id), -- NULL if added by organizer
  company_name TEXT NOT NULL,
  geo_markets TEXT[],
  industry TEXT,
  funding_target BIGINT,
  funding_stage TEXT,
  availability_status TEXT DEFAULT 'present',
  slot_availability JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Time slots
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  break_after INTEGER, -- minutes
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  time_slot_id UUID REFERENCES time_slots(id),
  compatibility_score INTEGER,
  score_breakdown TEXT[],
  status TEXT DEFAULT 'upcoming',
  completed BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔒 Step 4: Row-Level Security (RLS)

Enable RLS to ensure users only see their own data:

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policies: Organizers see all in their org
CREATE POLICY "Organizers see all org data"
  ON investors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = investors.event_id
      )
    )
  );

-- Policies: Investors see only their own data
CREATE POLICY "Investors see own data"
  ON investors FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'organizer'
      AND user_profiles.organization_id = (
        SELECT organization_id FROM events WHERE events.id = investors.event_id
      )
    )
  );

-- Similar policies for startups, matches, etc.
```

## 📝 Step 5: Environment Variables

Create `.env.local` file:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

Find these in: Supabase Dashboard → Settings → API

## 🚀 Step 6: Test Google Login

1. In your app, add login button:
```typescript
import { supabase } from '@/integrations/supabase/client';

const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
};
```

2. Create callback route: `/auth/callback`
3. Test login flow

---

## 💡 How Investors Enter Availability

### Option 1: Calendar View (Recommended)
- Investor logs in → sees their profile
- Clicks "Set Availability"
- Calendar shows all time slots
- Toggle on/off for each slot
- Saves to `slot_availability` JSONB field

### Option 2: Quick Toggle
- Simple list of time slots
- Checkboxes for each slot
- "Available" / "Not Available" buttons

### Implementation:
```typescript
// Investor availability component
const InvestorAvailability = ({ eventId, userId }) => {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  // Load time slots for event
  useEffect(() => {
    const loadSlots = async () => {
      const { data } = await supabase
        .from('time_slots')
        .select('*')
        .eq('event_id', eventId);
      setSlots(data || []);
    };
    loadSlots();
  }, [eventId]);

  // Load existing availability
  useEffect(() => {
    const loadAvailability = async () => {
      const { data } = await supabase
        .from('investors')
        .select('slot_availability')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single();
      if (data?.slot_availability) {
        setAvailability(data.slot_availability);
      }
    };
    loadAvailability();
  }, [userId, eventId]);

  // Save availability
  const saveAvailability = async () => {
    await supabase
      .from('investors')
      .update({ slot_availability: availability })
      .eq('user_id', userId)
      .eq('event_id', eventId);
  };

  return (
    <div>
      {slots.map(slot => (
        <div key={slot.id}>
          <label>
            <input
              type="checkbox"
              checked={availability[slot.id] ?? true}
              onChange={(e) => setAvailability({
                ...availability,
                [slot.id]: e.target.checked
              })}
            />
            {slot.label} ({slot.start_time} - {slot.end_time})
          </label>
        </div>
      ))}
      <button onClick={saveAvailability}>Save Availability</button>
    </div>
  );
};
```

---

## 🎯 Next Steps

1. ✅ Run database migrations
2. ✅ Set up Google OAuth
3. ✅ Create authentication flow
4. ✅ Build investor availability UI
5. ✅ Implement role-based access control

