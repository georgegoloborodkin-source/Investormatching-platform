# Smart CSV Converter - User Guide

## 🎯 What It Does

The **Smart CSV Converter** automatically detects and converts **any CSV format** to the platform's required format. Users no longer need to format their CSV files exactly - just upload and we'll handle the rest!

---

## ✨ Key Features

### 1. **Auto-Detection**
- Automatically detects if CSV contains startup or investor data
- No need to specify type manually

### 2. **Flexible Column Names**
Accepts **hundreds of column name variations**:

**For Startups:**
- `company_name`, `Company Name`, `companyname`, `Company`, `Name`, `Startup Name`, etc.
- `geo_markets`, `Geographic Markets`, `Markets`, `Regions`, `Locations`, etc.
- `industry`, `Sector`, `Vertical`, `Category`, etc.
- `funding_target`, `Funding Target`, `Funding Amount`, `Raise Amount`, etc.
- `funding_stage`, `Stage`, `Round`, `Funding Round`, etc.

**For Investors:**
- `firm_name`, `Firm Name`, `Company Name`, `VC Name`, `Fund Name`, etc.
- `geo_focus`, `Geographic Focus`, `Focus Regions`, `Target Regions`, etc.
- `industry_preferences`, `Preferred Industries`, `Industries`, `Sectors`, etc.
- `min_ticket_size`, `Minimum Ticket`, `Min Investment`, `Min Amount`, etc.
- `max_ticket_size`, `Maximum Ticket`, `Max Investment`, `Max Amount`, etc.
- `total_slots`, `Slots`, `Meeting Slots`, `Capacity`, etc.

### 3. **Smart Parsing**
- Handles different separators (comma, semicolon, tab)
- Handles quoted values with commas
- Parses numbers with currency symbols ($, €, £)
- Parses lists (semicolon, comma, or pipe separated)
- Handles missing columns gracefully

### 4. **Preview Before Import**
- Shows detected column mappings
- Displays preview of converted data
- Shows warnings and errors
- Shows statistics (total rows, valid rows, skipped rows)

### 5. **Confidence Scoring**
- High confidence (100%): Exact match
- Medium confidence (70%): Partial match
- Low confidence (50%): Fuzzy match

---

## 📋 How to Use

### **Option 1: Auto-Detect (Recommended)**
1. Click "Auto-Detect" tab
2. Upload your CSV file
3. Platform automatically detects if it's startups or investors
4. Review preview
5. Click "Import" to confirm

### **Option 2: Manual Selection**
1. Select "Startups" or "Investors" tab
2. Upload your CSV file
3. Review preview
4. Click "Import" to confirm

---

## 📊 Example CSV Formats Supported

### **Example 1: Standard Format**
```csv
Company Name,Industry,Funding Target,Funding Stage,Geo Markets
TechFlow AI,AI/ML,2000000,Series A,North America;Europe
```

### **Example 2: Different Column Names**
```csv
Name,Sector,Amount,Round,Regions
TechFlow AI,AI/ML,2000000,Series A,North America;Europe
```

### **Example 3: With Currency**
```csv
Company,Industry,Funding Target,Stage,Markets
TechFlow AI,AI/ML,$2,000,000,Series A,North America;Europe
```

### **Example 4: Different Separators**
```csv
Company Name;Industry;Funding Target;Funding Stage;Geo Markets
TechFlow AI;AI/ML;2000000;Series A;North America;Europe
```

### **Example 5: Quoted Values**
```csv
"Company Name","Industry","Funding Target","Funding Stage","Geo Markets"
"TechFlow AI","AI/ML","2000000","Series A","North America;Europe"
```

**All of these work!** The converter handles them automatically.

---

## 🔍 Column Mapping Examples

### **Startup Columns:**

| Your Column Name | Mapped To | Confidence |
|-----------------|-----------|------------|
| `Company Name` | `companyName` | 100% |
| `Startup` | `companyName` | 70% |
| `Business Name` | `companyName` | 70% |
| `Geographic Markets` | `geoMarkets` | 100% |
| `Regions` | `geoMarkets` | 70% |
| `Funding Target` | `fundingTarget` | 100% |
| `Raise Amount` | `fundingTarget` | 70% |
| `Funding Stage` | `fundingStage` | 100% |
| `Round` | `fundingStage` | 70% |

### **Investor Columns:**

| Your Column Name | Mapped To | Confidence |
|-----------------|-----------|------------|
| `Firm Name` | `firmName` | 100% |
| `VC Name` | `firmName` | 70% |
| `Company` | `firmName` | 50% |
| `Geographic Focus` | `geoFocus` | 100% |
| `Focus Regions` | `geoFocus` | 70% |
| `Industry Preferences` | `industryPreferences` | 100% |
| `Preferred Industries` | `industryPreferences` | 70% |
| `Min Ticket Size` | `minTicketSize` | 100% |
| `Minimum Investment` | `minTicketSize` | 70% |
| `Total Slots` | `totalSlots` | 100% |
| `Meeting Capacity` | `totalSlots` | 70% |

---

## ⚠️ Warnings & Errors

### **Warnings (Non-Critical)**
- Unrecognized columns (will be ignored)
- Missing optional fields (defaults applied)
- Low confidence mappings (may need review)

### **Errors (Critical)**
- Missing required columns (e.g., `company_name` or `firm_name`)
- Empty CSV file
- Invalid CSV format

---

## 🎯 Supported Formats

### **Separators:**
- ✅ Comma (`,`)
- ✅ Semicolon (`;`)
- ✅ Tab (`\t`)

### **Number Formats:**
- ✅ `2000000`
- ✅ `2,000,000`
- ✅ `$2,000,000`
- ✅ `€2,000,000`
- ✅ `£2,000,000`
- ✅ `2M` (future enhancement)

### **List Formats:**
- ✅ `North America;Europe` (semicolon)
- ✅ `North America,Europe` (comma)
- ✅ `North America|Europe` (pipe)
- ✅ `North America\nEurope` (newline)

### **Text Formats:**
- ✅ Quoted values: `"Company Name"`
- ✅ Unquoted values: `Company Name`
- ✅ Spaces, underscores, hyphens all handled

---

## 💡 Tips for Best Results

1. **Include Headers**: Make sure your CSV has a header row
2. **Required Fields**: 
   - Startups: Must have company name
   - Investors: Must have firm name
3. **Clear Column Names**: Use descriptive names (e.g., "Company Name" vs "C1")
4. **Consistent Format**: Keep number and list formats consistent
5. **Review Preview**: Always check the preview before importing

---

## 🔧 Technical Details

### **Detection Algorithm:**
1. Normalizes column names (lowercase, remove special chars)
2. Checks for exact matches
3. Checks for partial matches (contains)
4. Checks for fuzzy matches (similar words)
5. Assigns confidence scores

### **Parsing Algorithm:**
1. Detects separator (comma, semicolon, tab)
2. Handles quoted values
3. Parses numbers (removes currency, commas)
4. Parses lists (detects separator)
5. Applies defaults for missing fields

### **Error Handling:**
- Skips invalid rows (logs warning)
- Continues processing valid rows
- Reports all errors and warnings
- Shows statistics

---

## 📈 Benefits

### **For Users:**
- ✅ No need to reformat CSV files
- ✅ Works with existing spreadsheets
- ✅ Saves time
- ✅ Less frustration
- ✅ Preview before import

### **For Platform:**
- ✅ Better user experience
- ✅ Higher adoption rate
- ✅ Less support needed
- ✅ More flexible

---

## 🚀 Future Enhancements

- [ ] Excel file support (.xlsx, .xls)
- [ ] Google Sheets import
- [ ] Custom column mapping UI
- [ ] Batch import multiple files
- [ ] Import history
- [ ] Validation rules configuration
- [ ] Data transformation rules

---

## 📝 Example Workflow

1. **User has CSV** with columns: `Name`, `Sector`, `Amount`, `Round`, `Regions`
2. **Uploads file** via Auto-Detect
3. **Platform detects** it's startup data
4. **Maps columns**:
   - `Name` → `companyName` (70% confidence)
   - `Sector` → `industry` (70% confidence)
   - `Amount` → `fundingTarget` (50% confidence)
   - `Round` → `fundingStage` (70% confidence)
   - `Regions` → `geoMarkets` (70% confidence)
5. **Shows preview** with mapped data
6. **User reviews** and clicks "Import"
7. **Data imported** successfully!

**No manual formatting needed!** 🎉

---

The Smart CSV Converter makes importing data **effortless** for users!

