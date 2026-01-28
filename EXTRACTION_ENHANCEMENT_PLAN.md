# Document Extraction Enhancement Plan
## Goal: Match Gemini/ChatGPT Accuracy & Speed

### Current Limitations
1. **PDF Processing**: Limited to 8 pages, sequential fallbacks (PyMuPDF → PyPDF2 → pdfplumber → OCR)
2. **OCR**: Basic pytesseract (no context understanding)
3. **Tables**: Basic extraction, no structure preservation
4. **Layout**: No understanding of headers, footers, columns
5. **Speed**: Sequential processing, no parallelization
6. **Vision**: No vision models for scanned/image PDFs

### Enhancement Strategy

#### 1. **Vision Models for Complex PDFs** (Priority: HIGH)
- **Claude 3.5 Sonnet Vision** (using existing ANTHROPIC_API_KEY) for:
  - Scanned/image-only PDFs
  - Complex layouts (multi-column, headers/footers)
  - Tables with merged cells
  - Charts/diagrams with text
- **Cost**: ~$0.003 per image (1024x1024) - uses same API key as Claude answers
- **Speed**: 2-5s per page (parallelizable)

#### 2. **Parallel Page Processing** (Priority: HIGH)
- Process multiple PDF pages concurrently
- Use asyncio.gather() for parallel extraction
- **Speed gain**: 3-5x for multi-page PDFs

#### 3. **Advanced Table Extraction** (Priority: MEDIUM)
- **Camelot** or **tabula-py** for PDF tables
- **pandas** for Excel/CSV structure preservation
- **Markdown table format** for better context

#### 4. **Layout Understanding** (Priority: MEDIUM)
- Detect headers/footers (remove duplicates)
- Multi-column text reflow
- Section detection (titles, paragraphs, lists)

#### 5. **Smart Caching** (Priority: LOW)
- Cache extracted text by file hash
- Avoid re-processing unchanged files

#### 6. **Streaming Extraction** (Priority: LOW)
- Progressive extraction for large files
- Show progress to user

### Implementation Priority

**Phase 1 (Immediate - 2-3 hours):**
1. Add Gemini 1.5 Pro Vision API integration
2. Parallel page processing for PDFs
3. Better table extraction with Camelot

**Phase 2 (Next - 4-6 hours):**
4. Layout understanding (headers/footers)
5. Multi-column text reflow
6. Section detection

**Phase 3 (Future):**
7. Smart caching
8. Streaming extraction
9. Progress indicators

### Cost Analysis

**Current (per 100-page PDF):**
- PyMuPDF: ~$0 (free, 10-30s)
- OCR (pytesseract): ~$0 (free, 60-120s)

**Enhanced (per 100-page PDF):**
- Claude Vision (if needed): ~$0.30-3.00 (2-5s per page, parallel)
- Parallel PyMuPDF: ~$0 (free, 2-5s total)
- **Total**: ~$0.30-3.00 for 100 pages (vs $0 currently, but 10-20x faster)

**Recommendation**: Use vision models only when:
1. PyMuPDF extracts <50 chars per page (likely scanned)
2. User explicitly requests "high accuracy"
3. File is marked as "image-based"

### Speed Improvements

| Method | Current | Enhanced | Improvement |
|--------|---------|----------|-------------|
| 10-page PDF (text) | 5-10s | 1-2s | 5x faster |
| 10-page PDF (scanned) | 60-120s | 20-50s | 3-4x faster |
| 100-page PDF (text) | 50-100s | 5-10s | 10x faster |
| Complex table extraction | 10-20s | 2-5s | 4x faster |

### API Integration

**Claude 3.5 Sonnet Vision:**
```python
# Uses existing ANTHROPIC_API_KEY (same as Claude answers)
# Pricing: $0.003 per image (1024x1024)
# Best for: Scanned PDFs, complex layouts, tables
# Model: claude-3-5-sonnet-20241022

# Sends base64-encoded PNG images to Claude Vision API
# Automatically falls back when PyMuPDF extracts <50 chars
```

### Next Steps

1. ✅ **Uses existing ANTHROPIC_API_KEY** (no new keys needed)
2. ✅ **Implement parallel PDF processing** (ThreadPoolExecutor)
3. ✅ **Add Claude Vision fallback** for scanned PDFs
4. **Enhance table extraction** with Camelot (future)
5. **Test on real VC documents** (pitch decks, memos)
