# How to Paste Database Schema in Supabase

## 📍 Step 1: Open Supabase SQL Editor

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on your project
3. In the left sidebar, click **"SQL Editor"** (icon looks like a database/terminal)

## 📋 Step 2: Open the Migration File

1. In your code editor, open this file:
   ```
   remix-of-round-robin-meet/supabase/migrations/20250101000000_auth_and_roles.sql
   ```

2. **Select ALL** the content (Ctrl+A / Cmd+A)
3. **Copy** it (Ctrl+C / Cmd+C)

## 📝 Step 3: Paste in Supabase

1. In Supabase SQL Editor, you'll see a text area
2. **Paste** the entire SQL code (Ctrl+V / Cmd+V)
3. Click the **"Run"** button (or press Ctrl+Enter)

## ✅ Step 4: Verify It Worked

You should see:
- ✅ Green success message: "Success. No rows returned"
- ✅ Or a message showing tables were created

If you see errors, let me know!

---

## 🤔 What Am I Pasting? (Simple Explanation)

You're creating **database tables** - think of them as Excel spreadsheets that store your data.

### What Gets Created:

1. **`organizations`** - Stores VC firms/companies using the platform
   - Example: "Orbit Ventures", "Tech Capital Fund"

2. **`user_profiles`** - Stores user accounts (organizers & investors)
   - Links to Google login
   - Stores: name, email, role (organizer/investor)

3. **`events`** - Stores matchmaking events
   - Example: "Demo Day 2025", "Pitch Day March"

4. **`investors`** - Stores investor data
   - Firm name, preferences, availability
   - Links to user account (if they logged in)

5. **`startups`** - Stores startup data
   - Company name, funding needs, etc.

6. **`time_slots`** - Stores meeting time slots
   - Example: "9:00-9:20", "9:20-9:40"

7. **`matches`** - Stores the actual matches
   - Which startup meets which investor at what time

### Security Rules (RLS):

Also creates **Row-Level Security** policies - these ensure:
- ✅ Investors only see their own data
- ✅ Organizers see all data in their organization
- ✅ Users can't access other organizations' data

### Automatic Functions:

- Creates user profile automatically when someone signs up
- Updates timestamps automatically when data changes

---

## 🎯 Visual Guide

```
Supabase Dashboard
├── SQL Editor (click here!)
│   └── Paste entire SQL file
│       └── Click "Run"
│
└── Table Editor (after running, you'll see new tables here)
    ├── organizations
    ├── user_profiles
    ├── events
    ├── investors
    ├── startups
    ├── time_slots
    └── matches
```

---

## ⚠️ Common Issues

**Error: "relation already exists"**
- Tables already exist - that's OK! The migration uses `CREATE TABLE IF NOT EXISTS`
- Just continue

**Error: "permission denied"**
- Make sure you're logged into Supabase
- Make sure you're in the correct project

**Error: "syntax error"**
- Check if you copied the entire file
- Make sure there are no extra characters

---

## 🚀 After Running the Migration

1. Go to **"Table Editor"** in left sidebar
2. You should see all the new tables listed
3. Click on `user_profiles` - it should be empty (ready for users!)
4. Click on `organizations` - it should be empty (ready for your first org!)

---

## 💡 Next Steps

After the schema is created:
1. ✅ Test Google login
2. ✅ Create your first organization
3. ✅ Add your first event
4. ✅ Invite investors to sign up

