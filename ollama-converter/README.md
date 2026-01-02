# Ollama Data Converter

An intelligent data conversion service that uses Ollama (local LLM) to automatically transform unstructured data into structured Startup/Investor format for the VC matchmaking platform.

## 🎯 What It Does

This service can convert **any unstructured data** (text, emails, PDFs, messy CSV, JSON, etc.) into the structured format required by the platform:
- **Startups**: companyName, geoMarkets, industry, fundingTarget, fundingStage
- **Investors**: firmName, geoFocus, industryPreferences, stagePreferences, minTicketSize, maxTicketSize, totalSlots

## 🚀 Quick Start

### 1. Install Ollama

**Windows:**
1. Download from: https://ollama.com/download
2. Run the installer
3. Ollama will start automatically

**macOS:**
```bash
brew install ollama
ollama serve
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
```

### 2. Pull a Model

Choose one of these models (recommended in order):

```bash
# Best balance of speed and quality (recommended)
ollama pull llama3.2

# Or for better quality (slower)
ollama pull llama3.1

# Or for fastest (lower quality)
ollama pull llama3.2:1b
```

**Which model to choose?**
- **llama3.2** (2B params): ✅ Recommended - Good balance
- **llama3.1** (8B params): Better quality, slower
- **llama3.2:1b** (1B params): Fastest, lower quality
- **llama3.2:3b** (3B params): Good alternative

### 3. Create Custom Model (Optional)

For better results, create a custom model:

```bash
cd ollama-converter
ollama create vc-converter -f Modelfile
```

This creates a specialized model optimized for VC data conversion.

### 4. Install Python Dependencies

```bash
cd ollama-converter
pip install -r requirements.txt
```

### 5. Start the API Server

```bash
python main.py
```

The API will be available at `http://localhost:8000`

## 📖 Usage

### API Endpoints

#### 1. Health Check
```bash
curl http://localhost:8000/health
```

#### 2. List Available Models
```bash
curl http://localhost:8000/models
```

#### 3. Convert Unstructured Data

**Example 1: Text Input**
```bash
curl -X POST http://localhost:8000/convert \
  -H "Content-Type: application/json" \
  -d '{
    "data": "TechFlow AI is an AI/ML startup based in North America and Europe. They are seeking $2M in Series A funding.",
    "dataType": "startup"
  }'
```

**Example 2: Auto-detect Type**
```bash
curl -X POST http://localhost:8000/convert \
  -H "Content-Type: application/json" \
  -d '{
    "data": "VC Partners is a venture capital firm focusing on North America and Europe. They invest in AI/ML and SaaS companies at Seed and Series A stages. Minimum investment: $1M, Maximum: $5M. They have 4 meeting slots available."
  }'
```

**Example 3: File Upload**
```bash
curl -X POST http://localhost:8000/convert-file \
  -F "file=@data.txt" \
  -F "dataType=startup"
```

### Response Format

```json
{
  "startups": [
    {
      "companyName": "TechFlow AI",
      "geoMarkets": ["North America", "Europe"],
      "industry": "AI/ML",
      "fundingTarget": 2000000,
      "fundingStage": "Series A",
      "availabilityStatus": "present"
    }
  ],
  "investors": [],
  "detectedType": "startup",
  "confidence": 0.8,
  "warnings": [],
  "errors": []
}
```

## 🔧 Integration with Frontend

The frontend can call this API to convert unstructured data. See `src/utils/ollamaConverter.ts` for the integration.

## 💡 Examples of Unstructured Data It Can Handle

### Example 1: Email Text
```
Subject: Startup Pitch - HealthVision

Hi,

HealthVision is a healthtech startup looking for funding. We're based in North America and seeking $500K in seed funding. Our focus is on healthcare technology solutions.
```

### Example 2: Messy CSV
```
Name,Details
TechFlow,"AI company, $2M Series A, North America/Europe"
HealthVision,"Healthtech, $500K seed, North America"
```

### Example 3: JSON with Different Structure
```json
{
  "business": "TechFlow AI",
  "sector": "AI/ML",
  "funding": "$2,000,000",
  "round": "Series A",
  "locations": "North America, Europe"
}
```

### Example 4: Plain Text
```
VC Partners invests in AI/ML and SaaS startups at Seed and Series A stages. 
Geographic focus: North America and Europe. 
Investment range: $1M - $5M. 
Available slots: 4 meetings.
```

## ⚡ Performance & Efficiency

### Is It Efficient?

**Pros:**
- ✅ Runs locally (no API costs)
- ✅ Privacy (data never leaves your machine)
- ✅ Handles truly unstructured data (emails, text, PDFs)
- ✅ More flexible than rule-based parsers
- ✅ Can learn from examples

**Cons:**
- ⚠️ Slower than rule-based parsing (1-3 seconds per conversion)
- ⚠️ Requires GPU for best performance (CPU works but slower)
- ⚠️ Model size: 1-8GB depending on model

### Performance Tips

1. **Use smaller models** for faster processing (llama3.2:1b)
2. **Batch requests** when possible
3. **Use GPU** if available (automatic with Ollama)
4. **Cache results** for repeated conversions

### When to Use Ollama vs Rule-Based

**Use Ollama when:**
- Data is truly unstructured (emails, text, PDFs)
- Column names are unpredictable
- Data format varies significantly
- You need to extract from narrative text

**Use Rule-Based (smartCsvConverter.ts) when:**
- Data is CSV-like
- Column names are somewhat predictable
- Speed is critical
- You need real-time conversion

## 🛠️ Troubleshooting

### Ollama Not Found
```bash
# Check if Ollama is running
ollama list

# If not, start it
ollama serve
```

### No Models Available
```bash
# Pull a model
ollama pull llama3.2
```

### API Connection Error
- Make sure the API server is running on port 8000
- Check CORS settings if calling from frontend
- Verify Ollama is accessible

### Poor Conversion Quality
- Try a larger model (llama3.1 instead of llama3.2)
- Use the custom model: `ollama create vc-converter -f Modelfile`
- Provide more context in the input data
- Check the system prompt in `Modelfile`

## 📝 Configuration

Edit `main.py` to:
- Change the default model
- Adjust temperature (lower = more consistent)
- Modify system prompts
- Change port number

## 🔒 Privacy & Security

- ✅ All processing happens locally
- ✅ No data sent to external APIs
- ✅ Models run on your machine
- ✅ Perfect for sensitive VC data

## 📚 Resources

- Ollama Documentation: https://ollama.com/docs
- Model Library: https://ollama.com/library
- FastAPI Documentation: https://fastapi.tiangolo.com

## 🚀 Next Steps

1. Test with your data formats
2. Fine-tune the Modelfile for your specific needs
3. Integrate with frontend (see `src/utils/ollamaConverter.ts`)
4. Add caching for better performance
5. Consider batch processing for large datasets

