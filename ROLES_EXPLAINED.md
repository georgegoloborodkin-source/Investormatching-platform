# User Roles Explained (Simplified 2-Role System)

## 🎯 Why Only 2 Roles?

You're right - for a **matchmaking platform**, we don't need 4 roles. Here's the simplified system:

---

## Role 1: **Organizer** (Admin)

**Who:** VC firm admin, event manager, platform owner

**What they can do:**
- ✅ Create and manage events
- ✅ Add/edit/delete investors
- ✅ Add/edit/delete startups
- ✅ Generate matches
- ✅ View all data in their organization
- ✅ Override investor availability if needed
- ✅ Export schedules and reports

**Use case:** The person who runs the matchmaking event

---

## Role 2: **Investor** (Participant)

**Who:** VC team members (GPs, Principals, Associates)

**What they can do:**
- ✅ View their own schedule
- ✅ Set time slot availability
- ✅ Update their own profile
- ❌ Cannot see other investors' data
- ❌ Cannot create events
- ❌ Cannot generate matches

**Use case:** VC team members who participate in matchmaking

---

## ❌ Why We Removed LP & Startup Roles

### **LP (Limited Partner) - REMOVED**
- LPs invest **in the VC fund**, not directly in startups
- They don't participate in matchmaking events
- If you need portfolio analytics for LPs, that's a separate feature (not matchmaking)

### **Startup Role - REMOVED**
- Startups are **data entries**, not users
- Organizers add startups manually or via CSV
- If startups need to log in later, we can add the role back

---

## 🔄 How It Works

1. **First user** (Organizer) creates organization
2. **Organizer** invites investors via email (they sign up with Google)
3. **Investors** log in → see their profile → set availability
4. **Organizer** generates matches based on investor availability
5. **Investors** see their personalized schedule

---

## 💡 Future: Adding More Roles (If Needed)

If you later need:
- **LP role** → Add back for portfolio analytics dashboard
- **Startup role** → Add back if startups need to log in and set their own availability

But for MVP, **2 roles is enough!**

