# Quick Supabase Setup Checklist

## ✅ Step-by-Step Setup

### 1. Create Supabase Account
- Go to https://supabase.com
- Sign up with **Google** (recommended)
- Create new project: `investor-matching-platform`
- Save your database password!

### 2. Get Your Credentials
- Go to **Settings** → **API**
- Copy:
  - `Project URL` → `VITE_SUPABASE_URL`
  - `anon public` key → `VITE_SUPABASE_PUBLISHABLE_KEY`

### 3. Set Environment Variables
Create `.env.local` in project root:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Enable Google OAuth
1. **Supabase Dashboard** → **Authentication** → **Providers**
2. Toggle **Google** ON
3. Get Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project → **APIs & Services** → **Credentials**
   - **Create OAuth Client ID** → **Web application**
   - Add redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - Copy Client ID & Secret → Paste into Supabase

### 5. Run Database Migration
1. **Supabase Dashboard** → **SQL Editor**
2. Open file: `supabase/migrations/20250101000000_auth_and_roles.sql`
3. Copy entire SQL content
4. Paste into SQL Editor
5. Click **Run**

### 6. Test Login
1. Start your dev server: `npm run dev`
2. Navigate to `/login`
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Should redirect to `/` after login

---

## 🎯 User Roles Explained

**Simplified 2-role system:**

### **Organizer** (Admin - Full Access)
- Creates/manages events
- Adds investors & startups
- Generates matches
- Views all data in organization
- Can override investor availability if needed

### **Investor** (Participant - Self-Service)
- Views own schedule
- Sets time slot availability
- Updates own profile
- Cannot see other investors' data

**Note:** Startups are data entries managed by organizers. No login needed unless you want to add that later.

---

## 📝 How Investors Enter Availability

1. **Investor logs in** → Google OAuth
2. **Navigates to their profile** → "Set Availability"
3. **Sees all time slots** for active event
4. **Toggles checkboxes** for each slot
5. **Clicks "Save Availability"**
6. **Data saved** to `investors.slot_availability` JSONB field

### Example Availability Data:
```json
{
  "slot_1": true,
  "slot_2": true,
  "slot_3": false,
  "slot_4": true
}
```

---

## 🔒 Security (RLS Policies)

Row-Level Security ensures:
- ✅ Investors only see their own data
- ✅ Organizers see all org data
- ✅ Startups only see their own data
- ✅ LPs have read-only access

All policies are in the migration file.

---

## 🚀 Next Steps

1. ✅ Test Google login
2. ✅ Create test organization
3. ✅ Create test event
4. ✅ Add test investor with Google account
5. ✅ Test availability input
6. ✅ Test matching with availability constraints

---

## 💡 Tips

- **Default role**: New users get `investor` role (can be changed by organizer)
- **Organization creation**: First organizer creates org, others join
- **Event isolation**: Each event is separate, investors can be in multiple events
- **Availability override**: Organizers can override investor availability if needed

