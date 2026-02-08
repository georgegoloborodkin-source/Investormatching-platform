# 📥 Ingestion & Auto-Layout Guide

## 🎯 Where to Find Ingestion Features

### **1. Sources Tab** (Main Ingestion Hub)
**Location:** Click the **"Sources"** tab in the top navigation

**Features Available:**
- ✅ **Local File Upload**
  - Upload PDFs, DOCX, XLSX, CSV, TXT, MD, JSON
  - Auto-extracts text content
  - Stores in Supabase storage
  - Auto-indexes for semantic search

- ✅ **ClickUp Integration**
  - Import tasks from ClickUp lists
  - Auto-creates sources from tasks
  - Includes task status, assignees, URLs

- ✅ **Google Drive Integration**
  - Import Google Docs, Sheets, Slides
  - Direct URL import
  - Auto-extracts content

- ✅ **Auto-Extract Entities** (Toggle: ON/OFF)
  - When enabled, automatically extracts:
    - Companies, People, Funds
    - Relationships (partnerships, investments, etc.)
    - KPIs (revenue, funding, metrics)
  - Populates Knowledge Graph
  - Creates pending reviews for relationships

- ✅ **Folder Organization**
  - Create folders for documents
  - Assign documents to folders
  - Filter by folder in Knowledge Scope

### **2. Document Converter Tab**
**Location:** Click the **"Converter"** tab (if visible) or use the converter from Sources tab

**Features:**
- Paste text or upload files
- AI-powered extraction of structured data
- Auto-detects startup/investor data
- Validates extracted fields

---

## 🎨 Auto-Layout Features

### **1. Connections Graph Layout**
**Location:** Click the **"Connections Graph"** tab

**Auto-Layout Features:**
- Visual graph of company connections
- Auto-arranged nodes (companies)
- Color-coded by connection type:
  - **BD** (Business Development) - Yellow
  - **INV** (Investment) - Blue
  - **Partnership** - Green
  - **Portfolio** - Purple
  - **Knowledge** - Gray

- **Status Colors:**
  - To Connect - Yellow
  - In Progress - Orange
  - Connected - Green
  - Rejected - Red
  - Completed - Blue

### **2. Document Display Layout**
**Location:** Click on any document in Sources tab or chat sources

**Auto-Layout:**
- Responsive document viewer
- Auto-formatted text display
- Source references with clickable links
- Markdown rendering (headings, lists, bold, etc.)

### **3. Chat Interface Layout**
**Location:** **"Intelligence Chat"** tab (default)

**Auto-Layout:**
- Message bubbles (user vs assistant)
- Auto-scroll to latest message
- Source citations inline
- Markdown formatting
- Streaming responses with typing indicator

---

## 🚀 Quick Start: Upload & Ingest Documents

### **Step 1: Go to Sources Tab**
1. Click **"Sources"** in the top navigation
2. You'll see three ingestion options:
   - **Local Upload** (file picker)
   - **ClickUp** (list ID input)
   - **Google Drive** (URL input)

### **Step 2: Upload a Document**
1. Click **"Select files"** under Local Upload
2. Choose PDF, DOCX, or text file
3. Toggle **"Auto-extract entities"** ON (recommended)
4. Select a folder (optional)
5. Click **"Upload"**

### **Step 3: Check Auto-Extraction**
1. Go to **"Connections Graph"** tab
2. Click **"Pending Reviews"** section
3. Review auto-extracted relationships
4. Approve/Reject connections

---

## 📊 What Gets Auto-Extracted

When **Auto-Extract** is enabled:

### **Entities:**
- Companies (names, sectors, stages)
- People (founders, investors, advisors)
- Funds (VC firms, investment vehicles)
- Metrics (KPIs, valuations, funding amounts)

### **Relationships:**
- `partner_of` → Partnership connection
- `invested_in` → INV connection
- `portfolio_company` → Portfolio connection
- `competitor_of` → BD connection
- `acquired` → BD connection

### **KPIs:**
- Revenue, ARR, MRR
- Funding rounds, valuations
- Employee count, growth metrics
- Market data, sector info

---

## 🔍 Where to Check Ingestion Status

### **1. Sources Tab**
- See all uploaded documents
- View extraction status
- Check folder assignments

### **2. Connections Graph Tab**
- **Pending Reviews** section shows auto-extracted relationships
- Approve to create connections
- Reject to ignore

### **3. Dashboard Tab**
- Overview of all documents, sources, decisions
- Statistics and counts

### **4. Intelligence Chat**
- Ask questions about ingested documents
- Chat will reference uploaded sources
- Sources appear as clickable links

---

## ⚙️ Configuration

### **Auto-Extract Toggle**
- **Location:** Sources Tab → "Auto-extract entities" checkbox
- **Default:** ON
- **What it does:** Automatically runs entity extraction after upload

### **Folder Assignment**
- **Location:** Sources Tab → Folder dropdown
- **Create folders:** Click "Create Folder" button
- **Assign documents:** Select folder before upload, or use "Assign to Folder" dialog

### **Knowledge Scope**
- **Location:** Intelligence Chat → Knowledge Scope panel (left sidebar)
- **Filter documents:** Select "My docs" or specific folders
- **Team docs:** See documents from your organization

---

## 🐛 Troubleshooting

### **Documents Not Appearing?**
1. Check if `event_id` is set (auto-linking should fix this)
2. Refresh the page
3. Check browser console for errors

### **Auto-Extraction Not Working?**
1. Ensure "Auto-extract entities" toggle is ON
2. Check if Anthropic API key is configured
3. Verify document has extractable content
4. Check "Pending Reviews" in Connections Graph tab

### **Graph Not Showing?**
1. Ensure you've approved some relationships
2. Check if connections exist in database
3. Refresh the Connections Graph tab

---

## 📝 Notes

- **Ingestion** = Uploading and processing documents
- **Auto-Layout** = Automatic visual arrangement (graph, documents, chat)
- **Auto-Extract** = Automatic entity/relationship extraction from documents
- All features are in the **CIS (Company Intelligence System)** page
