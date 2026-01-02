# Ollama Data Converter - Complete Setup Guide

## 🎯 What You're Building

An intelligent data converter that uses **Ollama** (a local LLM framework) to automatically transform **any unstructured data** (text, emails, messy CSV, PDFs, etc.) into the structured format needed by your VC matchmaking platform.

## ✅ Why Use Ollama?

### Advantages:
- ✅ **Runs locally** - No API costs, complete privacy
- ✅ **Handles truly unstructured data** - Not just CSV variations, but emails, text, PDFs
- ✅ **More flexible** - Can understand context and extract from narrative text
- ✅ **No internet required** - Works offline
- ✅ **Free** - No per-request costs

### When to Use:
- Converting emails, text documents, or PDFs
- Handling unpredictable data formats
- Extracting information from narrative text
- When you need maximum flexibility

### When NOT to Use:
- Simple CSV files (use `smartCsvConverter.ts` instead - it's faster)
- Real-time conversions (Ollama takes 1-3 seconds)
- When speed is critical

## 📥 Step 1: Download & Install Ollama

### Windows:
1. Go to: **https://ollama.com/download**
2. Download the Windows installer
3. Run the installer
4. Ollama will start automatically in the background

**Verify installation:**
```powershell
ollama --version
```

### macOS:
```bash
brew install ollama
```

### Linux:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

## 🤖 Step 2: Pull a Model

You need to download at least one AI model. Choose based on your needs:

### Recommended: llama3.2 (2B parameters)
```bash
ollama pull llama3.2
```
- ✅ Best balance of speed and quality
- ✅ ~1.3GB download
- ✅ Fast inference (1-2 seconds)
- ✅ Good for most use cases

### Alternative Options:

**For Better Quality (slower):**
```bash
ollama pull llama3.1
```
- Better quality, slower (3-5 seconds)
- ~4.7GB download

**For Faster Speed (lower quality):**
```bash
ollama pull llama3.2:1b
```
- Fastest (0.5-1 second)
- ~1.1GB download
- Lower quality for complex extractions

**For Best Quality:**
```bash
ollama pull llama3.1:70b
```
- Best quality, very slow
- ~40GB download
- Only if you have powerful GPU

## 🎨 Step 3: Create Custom Model (Optional but Recommended)

For better results specific to VC data conversion:

```bash
cd ollama-converter
ollama create vc-converter -f Modelfile
```

This creates a specialized model optimized for your use case.

## 🐍 Step 4: Install Python Dependencies

```bash
cd ollama-converter
pip install -r requirements.txt
```

**If you don't have Python:**
- Download from: https://www.python.org/downloads/
- Make sure to check "Add Python to PATH" during installation

## 🚀 Step 5: Start the API Server

### Windows:
```powershell
cd ollama-converter
python main.py
```

Or double-click `start.bat`

### macOS/Linux:
```bash
cd ollama-converter
python3 main.py
```

Or:
```bash
chmod +x start.sh
./start.sh
```

The API will be available at: **http://localhost:8000**

## 🧪 Step 6: Test It

Open a new terminal and test:

```bash
# Health check
curl http://localhost:8000/health

# Test conversion
curl -X POST http://localhost:8000/convert -H "Content-Type: application/json" -d "{\"data\": \"TechFlow AI is an AI/ML startup seeking $2M in Series A funding. Based in North America and Europe.\", \"dataType\": \"startup\"}"
```

## 🔗 Step 7: Connect to Frontend

1. Make sure the API is running on `http://localhost:8000`
2. The frontend will automatically use it via `ollamaConverter.ts`
3. Add to your `.env` file if needed:
   ```
   VITE_OLLAMA_API_URL=http://localhost:8000
   ```

## 📊 Usage Examples

### Example 1: Convert Text
```typescript
import { convertWithOllama } from "@/utils/ollamaConverter";

const result = await convertWithOllama(
  "VC Partners invests in AI/ML startups at Seed stage. Focus: North America. Investment range: $1M-$5M. 4 slots available.",
  "investor"
);

console.log(result.investors);
```

### Example 2: Convert File
```typescript
import { convertFileWithOllama } from "@/utils/ollamaConverter";

const file = // ... file from input
const result = await convertFileWithOllama(file);
console.log(result.startups, result.investors);
```

### Example 3: Auto-detect Type
```typescript
const result = await convertWithOllama(
  "TechFlow AI is seeking $2M Series A funding in North America and Europe."
);
// Will auto-detect as startup
```

## ⚡ Performance Tips

1. **Use GPU if available** - Ollama automatically uses GPU
2. **Use smaller models** for faster processing
3. **Batch requests** when possible
4. **Cache results** for repeated conversions

## 🐛 Troubleshooting

### "Ollama not found"
- Make sure Ollama is installed
- On Windows, restart terminal after installation
- Try: `ollama list` to verify

### "No models available"
```bash
ollama pull llama3.2
```

### "Connection refused"
- Make sure API server is running: `python main.py`
- Check port 8000 is not blocked

### "Slow performance"
- Use smaller model: `ollama pull llama3.2:1b`
- Use GPU if available (automatic)
- Consider using rule-based converter for CSV files

### "Poor conversion quality"
- Use larger model: `ollama pull llama3.1`
- Use custom model: `ollama create vc-converter -f Modelfile`
- Provide more context in input data

## 📈 Efficiency Analysis

### Is It Efficient?

**For unstructured data (emails, text, PDFs):**
- ✅ **YES** - Much better than rule-based parsing
- ✅ Handles variations automatically
- ✅ Understands context

**For structured CSV:**
- ⚠️ **Maybe** - Rule-based is faster (milliseconds vs seconds)
- ⚠️ Use Ollama only if CSV format is unpredictable

**Recommendation:**
- Use **Ollama** for: emails, text documents, PDFs, unpredictable formats
- Use **smartCsvConverter.ts** for: CSV files, predictable formats, real-time needs

## 🎯 Next Steps

1. ✅ Install Ollama
2. ✅ Pull a model
3. ✅ Start the API
4. ✅ Test with your data
5. ✅ Integrate with frontend
6. ✅ Fine-tune Modelfile if needed

## 📚 Resources

- **Ollama Website**: https://ollama.com
- **Ollama Models**: https://ollama.com/library
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **Project README**: `ollama-converter/README.md`

## 💡 Pro Tips

1. **Create custom model** for better results
2. **Test with your actual data** to see what works best
3. **Combine approaches**: Use rule-based for CSV, Ollama for text
4. **Monitor performance** and adjust model size
5. **Cache common conversions** for better UX

---

**Ready to go!** Start the API and begin converting unstructured data automatically! 🚀

