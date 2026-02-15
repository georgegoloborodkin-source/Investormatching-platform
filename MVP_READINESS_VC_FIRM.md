# MVP Readiness Checklist — Tier 2 VC Firm Onboarding

**Goal:** Make the platform production-ready to onboard a tier 2 VC firm as the first paying client.

**Timeline:** 2-3 weeks to MVP-ready state

---

## 🔴 CRITICAL (Must Have Before Demo)

### 1. **Production Infrastructure & Reliability** (Week 1, Days 1-3)

#### Backend Stability
- [ ] **Production environment variables set**
  - `VITE_CONVERTER_API_URL` → Production Render backend
  - `VITE_SUPABASE_URL` → Production Supabase project
  - `VITE_SUPABASE_PUBLISHABLE_KEY` → Production key
  - All env vars configured in Vercel/Render (not just local `.env`)

- [ ] **Graceful API failure handling**
  - When converter API is down, show: *"AI features temporarily unavailable. You can still browse and manage documents."*
  - Don't crash the app — disable only chat/convert/embed actions
  - Add health check endpoint (`/health`) and UI indicator

- [ ] **Remove debug logs from production**
  - Frontend: Gate all `console.log` behind `import.meta.env.DEV`
  - Backend: Gate all `print()` behind `DEBUG=1` env var or remove from critical paths
  - **Current:** ~118 debug logs in `main.py`, many in `CIS.tsx`

- [ ] **User-friendly error messages**
  - Replace technical errors ("VITE_CONVERTER_API_URL is not set") with: *"AI service is not configured. Contact your administrator."*
  - Timeout errors: *"Request took too long. Please try a shorter question or try again later."*
  - No stack traces in production UI

#### Frontend Polish
- [ ] **Loading states for all async operations**
  - Chat: "Searching your documents..." → "Generating answer..."
  - Document upload: "Uploading..." → "Extracting text..." → "Indexing for search..."
  - Company card updates: Show spinner during save

- [ ] **Empty states with clear CTAs**
  - Documents tab: "No documents yet. Upload pitch decks or CSVs to get started."
  - Chat: "Ask a question about your documents"
  - Companies: "Upload documents to automatically create company cards"

---

### 2. **Multi-User Collaboration** (Week 1, Days 4-5)

**Current Gap:** No real-time sync — if User A edits a card, User B only sees it after refresh.

- [ ] **Auto-refresh or real-time updates**
  - **Option A (Simplest):** Auto-refresh CIS every 2-3 minutes + manual "Refresh" button
  - **Option B (Better):** Supabase Realtime subscriptions on `kg_entities`, `documents`, `company_connections`
  - **Recommendation:** Start with Option A (1-2 days), upgrade to Option B later

- [ ] **"Last updated by" tracking**
  - Add `updated_by` and `updated_at` to `kg_entities` table
  - Show "Last updated by [Name] at [time]" on company cards
  - Helps team know who changed what

- [ ] **Shared sync status**
  - Google Drive sync: Show "Last synced by [Name] at [time]" in Sync Status
  - One person's sync applies to entire team

---

### 3. **Data Security & Compliance** (Week 1, Days 6-7)

- [ ] **Row-Level Security (RLS) audit**
  - Verify all tables have RLS policies enforcing `organization_id` isolation
  - Test: User from Org A cannot see Org B's documents/cards
  - **Critical tables:** `documents`, `kg_entities`, `kg_edges`, `company_kpis`, `document_embeddings`

- [ ] **Data export capabilities**
  - Export company cards to CSV/Excel (all fields)
  - Export chat history to CSV
  - Export document list with metadata
  - **Use case:** VC firm wants to backup data or migrate

- [ ] **Audit logging (basic)**
  - Log who uploaded documents, edited cards, deleted items
  - Store in `audit_logs` table: `user_id`, `action`, `entity_type`, `entity_id`, `timestamp`
  - **Use case:** Compliance, debugging, accountability

---

## 🟡 HIGH PRIORITY (Should Have Before Launch)

### 4. **User Onboarding & Team Management** (Week 2, Days 1-3)

**Current:** Basic invitation system exists, but needs polish.

- [ ] **Structured onboarding flow**
  - Step 1: MD/Partner creates organization
  - Step 2: Invite team members via email (with role: `md`, `partner`, `principal`, `associate`, `analyst`)
  - Step 3: Team members accept invitation → auto-linked to org
  - Step 4: Onboarding checklist: "Upload your first deck", "Create a company card", "Ask a question"

- [ ] **Role-based permissions UI**
  - Show role badge in header: "MD", "Partner", "Analyst"
  - Disable actions based on role (e.g., analysts can't delete cards)
  - **Current:** Roles exist in DB but UI doesn't enforce them

- [ ] **Team management page**
  - List all team members with roles
  - MD/Partner can: invite, change roles, remove members
  - Show "Last active" timestamp

---

### 5. **Professional Features** (Week 2, Days 4-5)

- [ ] **Bulk operations**
  - Select multiple documents → assign to folder
  - Select multiple company cards → export to CSV
  - Select multiple documents → delete

- [ ] **Search & filtering**
  - Global search across documents, cards, chat history
  - Filter company cards by: industry, stage, funding amount, geo
  - Filter documents by: folder, date, type

- [ ] **Document versioning (basic)**
  - When re-uploading same document, keep old version
  - Show "Version 1, 2, 3..." in document list
  - **Use case:** Updated pitch decks, revised memos

---

### 6. **Analytics & Reporting** (Week 2, Days 6-7)

- [ ] **Dashboard metrics**
  - Total documents uploaded
  - Total company cards created
  - Documents by folder
  - Most active team members
  - AI extraction success rate

- [ ] **Usage analytics**
  - Chat questions asked per day/week
  - Documents uploaded per week
  - Cards auto-filled vs manually edited
  - **Use case:** Show value to VC firm, identify power users

---

## 🟢 NICE TO HAVE (Post-MVP)

### 7. **Integrations** (Week 3+)

- [ ] **CRM export** (Salesforce, HubSpot)
  - Export company cards → CSV → import to CRM
  - Map fields: company name, stage, amount seeking, contact info

- [ ] **Email notifications**
  - Notify team when: new document uploaded, card updated, sync completed
  - Daily/weekly digest: "5 new companies added this week"

- [ ] **API for integrations**
  - REST API to: create company cards, upload documents, query cards
  - API keys per organization
  - Rate limiting

---

## 📋 IMPLEMENTATION PRIORITY

### **Week 1: Stability & Collaboration**
1. Production env vars + graceful failures
2. Remove debug logs
3. User-friendly errors
4. Loading states
5. Auto-refresh + "last updated by"
6. RLS audit

### **Week 2: Professional Features**
7. Onboarding flow
8. Role-based permissions UI
9. Team management
10. Bulk operations
11. Search & filtering
12. Basic analytics dashboard

### **Week 3: Polish & Launch Prep**
13. Document versioning
14. Data export (CSV/Excel)
15. Audit logging
16. Demo script & documentation
17. Client onboarding materials

---

## 🎯 SUCCESS CRITERIA FOR MVP

**Before onboarding the VC firm, you must have:**

✅ **Reliability:** 99% uptime, no crashes, graceful error handling  
✅ **Security:** Complete data isolation between organizations  
✅ **Collaboration:** Team members see each other's changes in real-time (or near real-time)  
✅ **Usability:** Clear onboarding, no debug logs, professional UI  
✅ **Data Portability:** Export company cards and documents to CSV/Excel  
✅ **Support:** Basic audit logs for troubleshooting  

---

## 🚀 POST-MVP ROADMAP (Months 2-3)

- Advanced analytics (trends, insights)
- AI-powered deal recommendations
- Integration with CRM systems
- Mobile app (PWA)
- Advanced search (semantic search across all data)
- Custom fields on company cards
- Workflow automation (e.g., "When card updated, notify team")

---

## 📝 NOTES FOR VC FIRM DEMO

**Demo Script:**
1. Show onboarding flow (MD creates org, invites team)
2. Upload a pitch deck → auto-creates company card with 30+ fields
3. Ask AI chat: "What does this company do?" → shows sources
4. Edit company card → team sees changes
5. Export company cards to CSV
6. Show analytics dashboard

**Key Selling Points:**
- "Everything from the deck is automatically extracted"
- "Your team collaborates in real-time"
- "Your data is secure and isolated"
- "Export anytime — you own your data"

---

## ⚠️ RISKS TO MITIGATE

1. **Backend downtime:** Implement health checks + graceful degradation
2. **Data loss:** Regular backups + export functionality
3. **Performance:** Monitor embedding generation time, optimize if > 30s
4. **Cost:** Monitor Claude API usage, set budget alerts
5. **Security:** Regular RLS audits, penetration testing before launch

---

**Estimated Total Effort:** 2-3 weeks (1 developer, full-time)

**Next Step:** Start with Week 1, Day 1 — Production infrastructure setup.
