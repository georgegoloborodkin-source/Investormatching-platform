# 📊 Investor/Fund Viewing Guide

## ✅ Where to View Your Investors

**Location:** Click the **"Companies"** tab in the main navigation (top of the page)

### What You'll See:

1. **Filter Pills** (top left):
   - **"All"** — Shows both companies and funds
   - **"Companies"** — Only startup/company entities
   - **"Funds"** — Only investor/fund entities (your CSV data!)

2. **View Toggle** (top right):
   - **Card View** (default) — Visual cards with key info
   - **Table View** — Spreadsheet-style for quick scanning

3. **Fund Cards Show:**
   - **Header:** Fund name + "FUND" badge (blue)
   - **Quick Info:** Geo focus, industry preferences, team members
   - **Cheque Size Badge:** Investment range (e.g., "$500K - $1M")
   - **Click to Expand:** Full details

### Expanded Fund View Includes:
- ✅ Geo Focus (regions they invest in)
- ✅ Industry Preferences (verticals)
- ✅ Team Members (from CSV)
- ✅ Cheque Size Range
- ✅ One-Sentence Bio (editable)
- ✅ Website & Logo URL (editable)
- ✅ Source Documents (linked PDFs/CSVs)
- ✅ Connections (to other companies/funds)

---

## 🔍 Current Status

### ✅ What's Working:
1. **CSV Parsing:** Successfully extracts all 166 investors from ClickUp export
2. **Entity Creation:** Creates `fund` entities in `kg_entities` table
3. **Team Members:** Creates `person` entities and `works_at` edges
4. **Property Storage:** Stores geo_focus, industry_preferences, cheque_size, etc.
5. **Display:** Shows funds in Companies tab with proper filtering
6. **Updates:** Re-uploading CSV merges new data without overwriting manual edits

### ⚠️ What Needs Improvement:

#### 1. **Fund-Specific Fields Missing in Expanded View**
   - **Problem:** Expanded view shows "Investment Snapshot" (funding_stage, ARR, burn rate) which is for **companies**, not funds
   - **Should Show Instead:**
     - Fund Size / AUM
     - Portfolio Companies Count
     - Typical Check Size Range (already shown)
     - Investment Thesis
     - LP Information
     - Fund Stage (Fund I, Fund II, etc.)

#### 2. **Team Member Details**
   - **Current:** Only shows names as strings
   - **Should Have:** Clickable person cards with:
     - LinkedIn profiles
     - Roles (Partner, Principal, Analyst)
     - Contact info
     - Investment focus areas

#### 3. **Search & Filtering**
   - **Missing:** Search bar to find funds by name
   - **Missing:** Filter by geo focus (e.g., "Show only MENA funds")
   - **Missing:** Filter by industry preference (e.g., "Show only Fintech funds")
   - **Missing:** Filter by cheque size range

#### 4. **Bulk Actions**
   - **Missing:** Export all funds to CSV
   - **Missing:** Bulk edit properties
   - **Missing:** Tag/categorize funds

#### 5. **Data Quality**
   - **Issue:** Some CSV rows might have incomplete data (empty team members, missing geo focus)
   - **Solution:** Add validation warnings during ingestion

#### 6. **Connections Graph Integration**
   - **Current:** Funds appear in Connections Graph but relationships aren't auto-created
   - **Should:** Auto-create "invested_in" edges when portfolio companies are uploaded
   - **Should:** Show fund-to-fund relationships (co-investors, LPs)

---

## 🚀 Recommended Next Steps (Priority Order)

### **High Priority:**
1. **Fix Fund Expanded View** — Replace "Investment Snapshot" with fund-specific fields
2. **Add Search Bar** — Quick find by fund name
3. **Geo/Industry Filters** — Filter pills for common filters

### **Medium Priority:**
4. **Team Member Cards** — Rich person entity views
5. **Bulk Export** — Download all funds as CSV
6. **Data Validation** — Warn about incomplete rows during upload

### **Low Priority:**
7. **Fund-to-Fund Relationships** — Auto-detect co-investors
8. **Portfolio Company Links** — Auto-link funds to their portfolio companies
9. **Investment Thesis Field** — Add editable field for fund strategy

---

## 📝 Quick Test Checklist

After uploading your CSV, verify:

- [ ] **Companies Tab** shows funds (filter by "Funds")
- [ ] Fund cards display: name, geo focus, industry prefs, team members
- [ ] Expanded view shows fund-specific info (not company fields)
- [ ] Team members appear as clickable person entities
- [ ] Re-uploading CSV updates existing funds (doesn't create duplicates)
- [ ] Manual edits (bio, website) are preserved after CSV re-upload

---

## 🐛 Known Issues

1. **Expanded View Shows Wrong Fields:** Investment Snapshot fields (funding_stage, ARR) are for companies, not funds
2. **No Search:** Can't quickly find a fund by typing its name
3. **Team Members Not Rich:** Just text, not linked to person entities with details

---

## 💡 Tips

- **Use Table View** for quick scanning of all funds
- **Use Card View** for detailed exploration
- **Click any fund card** to expand and see full details
- **Edit fields inline** — changes save automatically
- **Filter by "Funds"** to hide companies and focus on investors only
