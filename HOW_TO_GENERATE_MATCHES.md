# How to Generate Matches - Step by Step Guide

## 🎯 How It's Supposed to Work

### **Step 1: Add Participants**
1. Go to **"Manage"** tab
2. Click **"Add Startup"** - Add at least one startup
3. Click **"Add Investor"** - Add at least one investor
4. Or use **"Import CSV"** to bulk import

### **Step 2: Configure Time Slots (Optional)**
1. Go to **"Time Slots"** tab
2. Default slots are already set (9:00 AM - 6:00 PM)
3. You can edit them if needed

### **Step 3: Generate Matches**
1. Click **"Generate Matches"** button in the header
2. Wait a moment (usually < 1 second)
3. You should see a success message
4. Matches will appear in **"Table View"** or **"Edit Schedule"** tabs

---

## ✅ Requirements for Generating Matches

### **Minimum Requirements:**
1. ✅ At least **1 startup** added
2. ✅ At least **1 investor** added
3. ✅ Both must have **availability status = "present"**
4. ✅ Investors must have **totalSlots > 0**

### **Recommended:**
- Multiple startups (3+)
- Multiple investors (2+)
- Time slots configured
- Complete data (industry, funding stage, etc.)

---

## 🔍 Troubleshooting: Why Matches Aren't Generating

### **Problem 1: Button is Disabled**
**Symptom:** "Generate Matches" button is grayed out

**Cause:** No startups or investors added

**Solution:**
1. Go to "Manage" tab
2. Add at least one startup
3. Add at least one investor
4. Button should become enabled

---

### **Problem 2: "No Available Startups" Error**
**Symptom:** Error message says "No Available Startups"

**Cause:** All startups are marked as "not attending"

**Solution:**
1. Go to "Manage" tab
2. Edit startups
3. Set "Availability Status" to "Present"
4. Try again

---

### **Problem 3: "No Available Investors" Error**
**Symptom:** Error message says "No Available Investors"

**Cause:** All investors are marked as "not attending"

**Solution:**
1. Go to "Manage" tab
2. Edit investors
3. Set "Availability Status" to "Present"
4. Try again

---

### **Problem 4: "No Investor Slots Available" Error**
**Symptom:** Error message says "No Investor Slots Available"

**Cause:** All investors have `totalSlots = 0`

**Solution:**
1. Go to "Manage" tab
2. Edit investors
3. Set "Total Slots" to a number > 0 (e.g., 3, 4, 5)
4. Try again

---

### **Problem 5: "No Matches Generated" Error**
**Symptom:** Success message but 0 matches

**Possible Causes:**
1. **No compatible matches** - Startups and investors don't match criteria
2. **No available time slots** - All slots marked as "done"
3. **Algorithm couldn't find valid pairings**

**Solutions:**
1. Check compatibility:
   - Do startups' industries match investors' preferences?
   - Do funding stages align?
   - Do geographic markets overlap?
2. Check time slots:
   - Go to "Time Slots" tab
   - Make sure slots aren't all marked as "done"
3. Add more participants:
   - More startups = more potential matches
   - More investors = more capacity

---

### **Problem 6: Matches Generated But Not Visible**
**Symptom:** Success message shows matches, but can't see them

**Solution:**
1. Go to **"Table View"** tab - Should show all matches
2. Go to **"Edit Schedule"** tab - Should show calendar view
3. Check filters - Make sure "Show Completed" is enabled
4. Refresh the page

---

## 🧪 Testing the Matching

### **Quick Test:**
1. Add 2 startups:
   - Startup 1: AI/ML, Series A, $2M, North America
   - Startup 2: Healthtech, Seed, $500K, North America

2. Add 1 investor:
   - Firm: VC Partners
   - Industries: AI/ML, Healthtech
   - Stages: Seed, Series A
   - Ticket: $1M - $5M
   - Total Slots: 4

3. Click "Generate Matches"
4. Should generate 2 matches (one for each startup)

---

## 📊 Understanding the Algorithm

### **What Happens When You Click "Generate Matches":**

1. **Filters Participants**
   - Only includes startups/investors with `availabilityStatus = 'present'`
   - Skips "not attending" participants

2. **Calculates Compatibility**
   - For each startup-investor pair:
     - Geographic match (40% weight)
     - Industry match (25% weight)
     - Stage match (20% weight)
     - Funding match (15% weight)
   - Creates compatibility score (0-100%)

3. **Distributes Fairly**
   - Ensures every startup gets meetings
   - Respects investor capacity (totalSlots)
   - Prevents conflicts (no double-booking)

4. **Assigns Time Slots**
   - Assigns each match to a time slot
   - Ensures no scheduling conflicts
   - Respects availability preferences

5. **Returns Matches**
   - Array of Match objects
   - Each with startup, investor, time slot, compatibility score

---

## 🎯 Expected Results

### **Small Event (3 startups, 2 investors):**
- **Expected Matches:** 3-6 matches
- **Time:** < 1 second
- **Distribution:** Each startup gets 1-2 meetings

### **Medium Event (10 startups, 5 investors):**
- **Expected Matches:** 10-20 matches
- **Time:** < 1 second
- **Distribution:** Each startup gets 2-4 meetings

### **Large Event (30 startups, 15 investors):**
- **Expected Matches:** 30-60 matches
- **Time:** 1-2 seconds
- **Distribution:** Each startup gets 2-4 meetings

---

## 💡 Tips for Best Results

1. **Complete Data:**
   - Fill in all fields (industry, stage, funding, geo)
   - More data = better matches

2. **Realistic Slots:**
   - Set investor totalSlots based on event duration
   - Example: 4-hour event = 8-12 slots per investor

3. **Compatible Data:**
   - Make sure some startups match investor preferences
   - Overlapping industries/stages = better matches

4. **Check Console:**
   - Open browser console (F12)
   - Look for error messages
   - Check debug logs

---

## 🔧 Debug Steps

If matches still aren't generating:

1. **Check Browser Console:**
   - Press F12
   - Look for errors (red text)
   - Check for "Generating matches with..." log

2. **Verify Data:**
   ```javascript
   // In browser console:
   console.log('Startups:', JSON.parse(localStorage.getItem('matchmaking-startups')));
   console.log('Investors:', JSON.parse(localStorage.getItem('matchmaking-investors')));
   ```

3. **Check Requirements:**
   - ✅ Startups.length > 0
   - ✅ Investors.length > 0
   - ✅ All have availabilityStatus = 'present'
   - ✅ Investors have totalSlots > 0
   - ✅ Time slots configured

4. **Try Manual Test:**
   - Add 1 startup with complete data
   - Add 1 investor with matching preferences
   - Set investor totalSlots = 3
   - Click "Generate Matches"
   - Should generate 1 match

---

## 📝 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Button disabled | No data | Add startups & investors |
| 0 matches | No compatible pairs | Check industry/stage alignment |
| Error message | Missing data | Fill in required fields |
| Slow generation | Large dataset | Normal for 100+ participants |
| Matches not showing | Wrong tab | Go to "Table View" tab |

---

## 🆘 Still Not Working?

1. **Check the error message** - It tells you exactly what's wrong
2. **Check browser console** - Look for JavaScript errors
3. **Verify data** - Make sure startups/investors have required fields
4. **Try with sample data** - Use the pre-loaded examples
5. **Refresh page** - Sometimes helps with state issues

The improved error handling will now tell you exactly what's wrong!

