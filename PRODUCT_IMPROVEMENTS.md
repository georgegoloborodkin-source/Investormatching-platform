# Product Improvements & Major Features

## 🎯 Overview

### 1. **Matching System Enhancements**

**Two-Pass Greedy Allocation Algorithm:**
- **Pass 1 (Fairness):** Iterates through each startup, finds all valid investor candidates (passing hard filters + score ≥70%), sorts by score descending, assigns the highest-scoring investor with available slots. Guarantees every startup gets at least one match if any valid investor exists.
- **Pass 2 (Utilization):** Collects all remaining unassigned candidate pairs, sorts by score descending, fills remaining investor slots until capacity is reached. Maximizes total matches while maintaining quality.

**Hard Filters (Non-Negotiable, Applied Before Scoring):**
- Industry match: `startup.industry` must be in `investor.industryPreferences` (case-insensitive)
- Geography overlap: `startup.geoMarkets ∩ investor.geoFocus` must be non-empty
- Funding range: `investor.minTicketSize ≤ startup.fundingTarget ≤ investor.maxTicketSize`

**Weighted Scoring System (0-100 points, only for matches passing hard filters):**
- Industry match: +30 points (fixed, since it's a hard filter requirement)
- Geo overlap: +20 points (fixed, lists overlapping markets)
- Funding proximity: +0 to +20 points (calculated as `20 * (1 - distance_from_midpoint / half_range)`, where midpoint = `(minTicketSize + maxTicketSize) / 2`)
- Stage alignment: +15 points if `startup.fundingStage` matches `investor.stagePreferences`, else 0
- Slots available: +15 points if investor has remaining slots > 0

**Slot Management:**
- Each investor has `totalSlots` capacity tracked via `investorUsedCount` Map
- `tryAssignCandidate()` function checks slot availability before assignment
- Prevents double-booking by maintaining `scheduleGrid` with `startupIds` and `investorIds` per time slot
- Only matches with score ≥70% are included in final output

**Deduplication (Three Layers):**
- By ID pair: `${startupId}::${investorId}` in `usedPairs` Set
- By firm: `${startupId}::${normalizedFirmName}` in `usedFirmPairs` Set (prevents same startup matching multiple members from same firm)
- By name pair: `${normalizedStartupName}::${normalizedFirmName}::${normalizedMemberName}` in `usedNamePairs` Set (prevents duplicate-looking rows when same company imported twice with different IDs)

### 2. **Investment Team Member System**

**Data Model:**
- Added required `memberName: string` field to `Investor` type
- Display format: `${firmName} (${memberName})` for all investor references

**Member Filtering in Edit Schedule:**
- Dropdown selector with `MEMBER_ALL = "__all__"` constant (prevents Radix Select empty string error)
- Filters matches: `visibleMatches = memberFocus === MEMBER_ALL ? allMatches : matches.filter(m => investor.memberName === memberFocus)`
- Groups filtered matches by time slot: `groupedMatches[timeSlot.label] = Match[]`

**Call Sheet Generation:**
- Sorts matches chronologically by time slot index: `callSheetSorted.sort((a, b) => timeSlotIndex(a) - timeSlotIndex(b))`
- Displays: Time range, Slot label, Startup name, Firm name, Table number
- CSV export: Headers `["Time", "Slot", "Startup", "Firm", "Member", "Table"]` with one row per match
- ICS export: Uses `buildMemberCallSheetIcs()` function generating VEVENT blocks with `DTSTART`/`DTEND` in local format (`YYYYMMDDTHHmmss`), `SUMMARY: Call: {startupName}`, `LOCATION: Table {tableNumber}`

**Conflict Detection:**
- Per time slot: Counts occurrences of `startupId`, `investorId`, and `memberName` in `groupedMatches[slot.label]`
- Flags conflicts: `conflictBySlot[slot.label] = startupConflicts + investorConflicts + memberConflicts`
- Auto-fix: Moves non-locked/non-completed conflicting matches to nearest available slot that doesn't contain the same startup/investor/member

### 3. **AI-Powered Multi-Format File Converter**

**File Type Detection (Magic Bytes):**
- PDF: Searches first 2048 bytes for `b'%PDF'` header
- DOCX/XLSX: Detects `b'PK'` ZIP header, opens ZIP to check contents: `word/document.xml` → DOCX, `xl/workbook.xml` → XLSX
- XLS: Detects OLE2 compound document header `b'\xd0\xcf\x11\xe0'`
- Falls back to file extension if magic bytes don't match

**Text Extraction by Format:**
- **PDF:** Uses PyPDF2 first, falls back to pdfplumber for better table extraction
- **XLSX:** Uses openpyxl to read workbook, iterates all sheets, extracts cell values
- **XLS:** Uses xlrd library to read legacy Excel format
- **DOCX:** Opens as ZIP, reads `word/document.xml`, extracts text nodes via XML parsing
- **DOC:** Reads as binary, decodes with latin-1, uses regex to clean text
- **CSV/TXT/JSON:** Decodes as UTF-8, JSON parsed with `json.loads()`

**Ollama LLM Integration:**
- Model selection: Prioritizes `vc-converter:latest`, then `llama3.1`, `llama3.2`, else first available
- Model detection: Uses Ollama HTTP API `/api/tags` endpoint (more reliable than Python client on Windows)
- Prompt: Sends extracted text with schema instructions, requests JSON array of `StartupData`/`InvestorData` objects
- Response parsing: Validates JSON, handles array or single object, skips non-dict items

**Data Normalization:**
- **Startup:** `safe_str()` strips whitespace, handles None; `safe_int()` extracts numbers from strings (removes currency symbols, handles "M"/"K" multipliers); `geoMarkets` split by `[,;|]` if string
- **Investor:** `parse_list()` splits comma/semicolon/pipe-separated strings; `parse_number()` handles currency ("$5M" → 5000000), multipliers, extracts digits; `memberName` tries multiple field aliases (`memberName`, `investorMemberName`, `contactName`, `partnerName`, `personName`)

**Row-Level Validation:**
- Required fields checked: Startups (`companyName`, `geoMarkets`, `industry`, `fundingTarget`, `fundingStage`), Investors (`firmName`, `memberName`, `geoFocus`, `industryPreferences`, `minTicketSize`, `maxTicketSize`, `totalSlots`)
- Error format: `"Row {index} missing {fieldName}"` for each missing field
- Blocks matching until all required fields present in all rows

**API Architecture:**
- FastAPI backend on port 8010-8015 (auto-detects free port)
- CORS enabled for `allow_origins=["*"]` (dev-friendly)
- Endpoints: `/convert-file` (POST, file upload), `/validate-file` (POST, validation only), `/health` (GET, Ollama status)
- Error handling: Returns 400 for unsupported formats, 503 for Ollama unavailable, 500 for parsing failures with specific error messages
