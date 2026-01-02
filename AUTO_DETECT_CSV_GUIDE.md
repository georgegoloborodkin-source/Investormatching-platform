# Smart Auto-Detect CSV Upload - Complete Guide

## 🎯 What's New

The CSV upload now has **intelligent auto-detection** that:
- ✅ **Auto-detects** if CSV contains startups, investors, or both
- ✅ **Works with any column names** - no formatting required
- ✅ **Handles mixed CSVs** - startups and investors in the same file
- ✅ **Smart column mapping** - automatically maps to correct fields

---

## 🚀 How to Use

### **Single Upload (Recommended)**

1. Click **"Import CSV"** button in header
2. You'll see **"Smart Auto-Detect Upload"** interface
3. Click **"Select CSV file"**
4. Upload **any CSV format**
5. Platform automatically:
   - Detects if it's startups, investors, or both
   - Maps columns to correct fields
   - Shows preview
6. Click **"Import"** to confirm

**That's it!** No need to specify type or format.

---

## 📊 Supported Formats

### **Format 1: Startups Only**
```csv
Company Name,Industry,Funding Target,Funding Stage,Geo Markets
TechFlow AI,AI/ML,2000000,Series A,North America;Europe
HealthVision,Healthtech,500000,Seed,North America
```

### **Format 2: Investors Only**
```csv
Firm Name,Geo Focus,Industry Preferences,Min Ticket,Max Ticket,Total Slots
VC Partners,North America;Europe,AI/ML;SaaS,1000000,5000000,4
Health Fund,North America,Healthtech,250000,2000000,3
```

### **Format 3: Mixed (Both in One File)**
```csv
Type,Name,Industry,Funding Target,Funding Stage,Geo Markets
Startup,TechFlow AI,AI/ML,2000000,Series A,North America
Investor,VC Partners,AI/ML;SaaS,1000000,5000000,North America
Startup,HealthVision,Healthtech,500000,Seed,North America
Investor,Health Fund,Healthtech,250000,2000000,North America
```

### **Format 4: Any Column Names**
```csv
Business Name,Sector,Amount Seeking,Round,Regions
TechFlow AI,AI/ML,$2,000,000,Series A,North America;Europe
```

**All of these work!** The platform handles them automatically.

---

## 🔍 How Auto-Detection Works

### **Step 1: Column Detection**
Scans column headers for keywords:
- **Startup indicators:** company, startup, funding target, funding stage, raise, amount
- **Investor indicators:** firm, VC, fund, ticket size, industry preferences, slots

### **Step 2: Type Detection**
- If only startup indicators → Detected as startups
- If only investor indicators → Detected as investors
- If both indicators → Detected as mixed CSV

### **Step 3: Column Mapping**
For each column, finds best match:
- `Company Name` → `companyName` (100% confidence)
- `Firm` → `firmName` (70% confidence)
- `Amount` → `fundingTarget` (50% confidence)

### **Step 4: Row Parsing (for Mixed CSVs)**
For each row:
- Checks for "Type" column (if exists)
- Or auto-detects based on data patterns
- Parses as startup or investor accordingly

---

## 💡 Examples

### **Example 1: Standard Startup CSV**
```csv
Company Name,Industry,Funding Target,Funding Stage,Geo Markets
TechFlow AI,AI/ML,2000000,Series A,North America;Europe
```

**Result:**
- ✅ Detected as: Startups
- ✅ Mapped: All columns correctly
- ✅ Imported: 1 startup

---

### **Example 2: Different Column Names**
```csv
Name,Sector,Amount,Round,Regions
TechFlow AI,AI/ML,2000000,Series A,North America;Europe
```

**Result:**
- ✅ Detected as: Startups
- ✅ Mapped: 
  - `Name` → `companyName` (70%)
  - `Sector` → `industry` (70%)
  - `Amount` → `fundingTarget` (50%)
  - `Round` → `fundingStage` (70%)
  - `Regions` → `geoMarkets` (70%)
- ✅ Imported: 1 startup

---

### **Example 3: Mixed CSV**
```csv
Type,Name,Industry,Funding Target,Funding Stage,Geo Markets
Startup,TechFlow AI,AI/ML,2000000,Series A,North America
Investor,VC Partners,AI/ML;SaaS,1000000,5000000,North America
Startup,HealthVision,Healthtech,500000,Seed,North America
```

**Result:**
- ✅ Detected as: Mixed
- ✅ Separated: 2 startups, 1 investor
- ✅ Imported: Both types

---

### **Example 4: Auto-Detected Mixed (No Type Column)**
```csv
Name,Industry,Funding Target,Funding Stage,Geo Markets
TechFlow AI,AI/ML,2000000,Series A,North America
VC Partners,AI/ML;SaaS,1000000,5000000,North America
HealthVision,Healthtech,500000,Seed,North America
```

**Result:**
- ✅ Detected as: Mixed (by data patterns)
- ✅ Row 1: Startup (has funding target, no ticket size)
- ✅ Row 2: Investor (has ticket size range, no funding stage)
- ✅ Row 3: Startup (has funding target, no ticket size)
- ✅ Imported: 2 startups, 1 investor

---

## 🎯 Detection Logic

### **Startup Detection:**
Row is a startup if it has:
- Company name field populated
- Funding target or funding stage
- No ticket size or industry preferences

### **Investor Detection:**
Row is an investor if it has:
- Firm name field populated
- Ticket size (min/max) or total slots
- Industry preferences or stage preferences

### **Mixed CSV Detection:**
File is mixed if:
- Headers contain both startup AND investor indicators
- OR rows contain both types of data

---

## ⚠️ Tips for Best Results

### **1. Clear Column Names**
Use descriptive names:
- ✅ Good: "Company Name", "Firm Name", "Funding Target"
- ⚠️ OK: "Name", "Amount", "Industry"
- ❌ Avoid: "C1", "Field1", "Data"

### **2. Include Type Column (for Mixed CSVs)**
If mixing startups and investors, add a "Type" column:
```csv
Type,Name,Industry,...
Startup,TechFlow AI,AI/ML,...
Investor,VC Partners,AI/ML;SaaS,...
```

### **3. Complete Data**
Fill in as many fields as possible:
- More data = better detection
- More data = better matching

### **4. Consistent Format**
Keep formats consistent:
- Use same separator throughout
- Use same number format
- Use same list separator (semicolon, comma, etc.)

---

## 🔧 Troubleshooting

### **Problem: "Could not auto-detect CSV type"**

**Causes:**
- Ambiguous column names
- Missing required fields
- Unclear data patterns

**Solutions:**
1. Add a "Type" column for mixed CSVs
2. Use clearer column names
3. Ensure at least one required field is present

### **Problem: Wrong Type Detected**

**Causes:**
- Column names match both types
- Data patterns are ambiguous

**Solutions:**
1. Add a "Type" column
2. Use more specific column names
3. Check preview before importing

### **Problem: Some Rows Skipped**

**Causes:**
- Missing required fields (company name or firm name)
- Couldn't determine type (for mixed CSVs)

**Solutions:**
1. Fill in required fields
2. Add "Type" column for mixed CSVs
3. Check warnings in preview

---

## 📋 Column Name Variations Supported

### **For Startups:**
- Company: `company_name`, `Company Name`, `companyname`, `Name`, `Startup Name`, `Business Name`, `Company`, `Firm`
- Industry: `industry`, `Sector`, `Vertical`, `Category`, `Industry Type`
- Funding: `funding_target`, `Funding Target`, `fundingtarget`, `Amount`, `Raise Amount`, `Funding Amount`, `Investment Target`, `Seeking`
- Stage: `funding_stage`, `Funding Stage`, `fundingstage`, `Stage`, `Round`, `Funding Round`, `Investment Stage`
- Markets: `geo_markets`, `Geographic Markets`, `Markets`, `Regions`, `Locations`, `Geo`, `Geographic Regions`

### **For Investors:**
- Firm: `firm_name`, `Firm Name`, `firmname`, `Firm`, `VC Name`, `Fund Name`, `Investor Name`, `Company Name`
- Focus: `geo_focus`, `Geographic Focus`, `Focus Regions`, `Target Regions`, `Geography`, `Regions`, `Markets`
- Preferences: `industry_preferences`, `Preferred Industries`, `Industries`, `Sectors`, `Vertical Preferences`, `Industry Focus`
- Ticket: `min_ticket_size`, `Minimum Investment`, `Min Amount`, `Ticket Min`, `Min Check`, `min_ticket`, `minticketsize`
- Slots: `total_slots`, `Slots`, `Meeting Slots`, `Capacity`, `Meetings`, `Max Meetings`, `Slot Count`

---

## 🎉 Benefits

### **For Users:**
- ✅ **No formatting needed** - upload any CSV
- ✅ **Saves time** - no manual column mapping
- ✅ **Less errors** - automatic validation
- ✅ **Flexible** - works with existing spreadsheets
- ✅ **Mixed support** - one file for both types

### **For Platform:**
- ✅ **Better UX** - easier to use
- ✅ **Higher adoption** - less friction
- ✅ **Less support** - fewer questions
- ✅ **More flexible** - handles edge cases

---

## 📝 Example Workflows

### **Workflow 1: Single Type CSV**
1. User has CSV with startups
2. Uploads file
3. Platform detects: "Startups"
4. Maps columns automatically
5. Shows preview
6. User confirms
7. ✅ Imported!

### **Workflow 2: Mixed CSV**
1. User has CSV with both startups and investors
2. Uploads file
3. Platform detects: "Mixed"
4. Separates rows by type
5. Maps columns for each type
6. Shows preview (both types)
7. User confirms
8. ✅ Both imported!

### **Workflow 3: Unknown Format**
1. User has CSV with unclear format
2. Uploads file
3. Platform tries both parsers
4. Uses whichever works better
5. Shows preview with warnings
6. User reviews and confirms
7. ✅ Imported!

---

## 🚀 Try It Now!

1. **Prepare any CSV** (any format, any column names)
2. **Click "Import CSV"**
3. **Upload your file**
4. **Review the preview**
5. **Click "Import"**

**It just works!** 🎉

---

The smart auto-detect makes CSV import **effortless** - users can upload any format and the platform handles the rest!

