# 🚀 Quick Start: Ollama Data Converter

## What You Need to Do (5 Steps)

### 1. Download Ollama
- **Windows**: https://ollama.com/download → Download & Install
- **macOS**: `brew install ollama`
- **Linux**: `curl -fsSL https://ollama.com/install.sh | sh`

### 2. Pull a Model
```bash
ollama pull llama3.2
```
This downloads ~1.3GB. Takes 2-5 minutes depending on internet speed.

### 3. Install Python Dependencies
```bash
cd ollama-converter
pip install -r requirements.txt
```

### 4. Start the API
```bash
python main.py
```
Keep this terminal open! The API runs on `http://localhost:8000`

### 5. Use It!
- Open your frontend app
- Go to CSV Upload
- Check "Use AI Converter (Ollama)" checkbox
- Upload any file (CSV, text, etc.)

## ✅ That's It!

The AI converter will automatically extract structured data from unstructured input.

## 🎯 Which Model to Use?

| Model | Speed | Quality | Size | Best For |
|-------|-------|---------|------|----------|
| `llama3.2:1b` | ⚡⚡⚡ Fast | ⭐⭐ Good | 1.1GB | Quick conversions |
| `llama3.2` | ⚡⚡ Medium | ⭐⭐⭐ Very Good | 1.3GB | **Recommended** |
| `llama3.1` | ⚡ Slow | ⭐⭐⭐⭐ Excellent | 4.7GB | Best quality |

**Recommendation**: Start with `llama3.2` - best balance!

## 💡 Pro Tips

1. **Create custom model** for better results:
   ```bash
   cd ollama-converter
   ollama create vc-converter -f Modelfile
   ```

2. **Test it first**:
   ```bash
   curl http://localhost:8000/health
   ```

3. **Use for unstructured data**: Emails, text, PDFs, messy CSV
4. **Use rule-based for CSV**: Faster for structured CSV files

## 🐛 Troubleshooting

**"Ollama not found"**
- Restart terminal after installing Ollama
- Try: `ollama list` to verify

**"No models available"**
- Run: `ollama pull llama3.2`

**"Connection refused"**
- Make sure API is running: `python main.py`
- Check port 8000 is not blocked

## 📚 Full Documentation

See `OLLAMA_SETUP_GUIDE.md` for complete details.

---

**Ready?** Start with step 1! 🎉

