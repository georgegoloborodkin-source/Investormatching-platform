# 🧪 Testing the Ollama Converter

## What This Does

The converter now has **validation** - it tells you exactly what's missing from your data!

**Workflow:**
1. Investment team sends incomplete startups/investors table
2. Ollama converts what it can
3. **System identifies what's missing**
4. **Returns a report: "You need to add X, Y, Z"**

## 🚀 Quick Test

### 1. Start the API
```bash
cd ollama-converter
python main.py
```

### 2. Run the Test Script
```bash
python test_validation.py
```

This will test:
- ✅ Incomplete startup data
- ✅ Incomplete investor data  
- ✅ Messy table data
- ✅ Validation endpoint (what's missing?)

## 📋 Manual Testing

### Test 1: Incomplete Startup Data

**Send this (missing geo markets and funding stage):**
```json
{
  "data": "Company: TechFlow AI\nIndustry: AI/ML\nFunding: $2M",
  "dataType": "startup"
}
```

**Expected Response:**
- ✅ Extracts: companyName, industry, fundingTarget
- ❌ Missing: geoMarkets, fundingStage
- 💡 Suggestions: "Add geographic markets for TechFlow AI", "Add funding stage..."

### Test 2: Incomplete Investor Data

**Send this (missing ticket sizes):**
```json
{
  "data": "Firm: VC Partners\nFocus: North America\nIndustries: AI/ML, SaaS",
  "dataType": "investor"
}
```

**Expected Response:**
- ✅ Extracts: firmName, geoFocus, industryPreferences
- ❌ Missing: minTicketSize, maxTicketSize, stagePreferences
- 💡 Suggestions: "Add minimum ticket size...", "Add stage preferences..."

### Test 3: Validation Endpoint

**Use the `/validate` endpoint to get a detailed report:**

```bash
curl -X POST http://localhost:8000/validate \
  -H "Content-Type: application/json" \
  -d '{
    "data": "Company: TechFlow AI\nIndustry: AI/ML\nFunding: $2M",
    "dataType": "startup"
  }'
```

**Response:**
```json
{
  "isValid": false,
  "missingFields": {
    "startups": ["geoMarkets", "fundingStage"],
    "investors": []
  },
  "suggestions": [
    "Add geographic markets for TechFlow AI",
    "Add funding stage (Pre-seed, Seed, Series A, etc.) for TechFlow AI"
  ],
  "extractedData": {
    "startups": [...],
    "detectedType": "startup",
    "confidence": 0.8
  }
}
```

## 🎯 Real-World Scenario

### Investment Team Workflow:

1. **Team sends messy data:**
   ```
   Name,Details
   TechFlow,"AI company, $2M"
   HealthVision,Healthtech startup
   VC Partners,"Invests in tech"
   ```

2. **System processes it:**
   - Converts what it can
   - Identifies missing fields
   - Generates suggestions

3. **System responds:**
   ```
   ✅ Extracted 2 startups, 1 investor
   
   ⚠️ Missing Information:
   
   TechFlow AI:
   - Geographic markets
   - Funding stage
   
   HealthVision:
   - Funding target
   - Geographic markets
   - Funding stage
   
   VC Partners:
   - Minimum ticket size
   - Maximum ticket size
   - Stage preferences
   ```

4. **Team adds missing info and resubmits**

## 🔍 API Endpoints

### `/convert` - Convert data
Converts unstructured data to structured format.

### `/validate` - Validate and report missing fields ⭐ NEW
Tells you exactly what's missing!

**Request:**
```json
{
  "data": "...",
  "dataType": "startup" | "investor" | null
}
```

**Response:**
```json
{
  "isValid": false,
  "missingFields": {
    "startups": ["geoMarkets", "fundingStage"],
    "investors": ["minTicketSize"]
  },
  "suggestions": [
    "Add geographic markets for TechFlow AI",
    "Add funding stage for TechFlow AI"
  ],
  "extractedData": {...}
}
```

## 💡 Integration with Frontend

The frontend can now:
1. Show extracted data
2. **Highlight missing fields in red**
3. **Display suggestions: "Please add: X, Y, Z"**
4. Allow user to add missing info before importing

## ✅ Success Criteria

The converter works perfectly if:
- ✅ Extracts all available information
- ✅ Identifies missing required fields
- ✅ Provides clear suggestions
- ✅ Handles messy/incomplete data gracefully
- ✅ Returns structured validation report

## 🐛 Troubleshooting

**"No data extracted"**
- Check if Ollama is running
- Verify model is available: `ollama list`
- Check API logs for errors

**"Missing fields not detected"**
- Make sure you're using `/validate` endpoint
- Check that data actually has missing fields
- Review validation logic in `main.py`

## 📊 Example Test Results

```
✅ Test 1: Incomplete Startup Data
   - Extracted: companyName, industry, fundingTarget
   - Missing: geoMarkets, fundingStage
   - Status: PASS

✅ Test 2: Incomplete Investor Data
   - Extracted: firmName, geoFocus, industryPreferences
   - Missing: minTicketSize, maxTicketSize, stagePreferences
   - Status: PASS

✅ Test 3: Validation Endpoint
   - Returns detailed missing fields report
   - Provides suggestions
   - Status: PASS
```

---

**Ready to test?** Run `python test_validation.py` and see it in action! 🚀

