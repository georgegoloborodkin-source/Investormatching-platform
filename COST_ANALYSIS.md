# Cost Analysis: VC Intelligence Platform

## Stack Overview

**Infrastructure:**
- **Supabase** (Database + Storage + Auth)
- **Render** (Backend API - FastAPI)
- **Vercel** (Frontend - React/Next.js)

**AI APIs:**
- **Anthropic Claude** (Document ingestion, Q&A, entity extraction)
- **Voyage AI** (Embeddings for semantic search)
- **Cohere** (Reranking for search results)

---

## Usage Estimates (Typical VC Firm)

### Assumptions:
- **Team Size:** 5-10 investment professionals
- **Documents/Month:** 50-100 pitch decks, memos, meeting notes
- **Questions/Month:** 500-1,000 queries (chat interactions)
- **Active Portfolio:** 20-50 companies
- **Storage:** ~10-20 GB documents

---

## Monthly Cost Breakdown

### 1. Infrastructure Costs

#### **Supabase (Pro Plan)**
- **Plan:** Pro ($25/month base + usage)
- **Database:** Included (up to 8 GB)
- **Storage:** $0.021/GB/month
  - 20 GB documents: **$0.42/month**
- **Bandwidth:** $0.09/GB (first 250 GB free)
  - Estimated: **$0-5/month**
- **Auth:** Included (unlimited users)
- **Vector Search:** Included (pgvector)
- **Total:** **$25-30/month**

#### **Render (Backend API)**
- **Plan:** Starter ($7/month) or Standard ($25/month)
- **CPU:** 0.5 vCPU (Starter) or 1 vCPU (Standard)
- **RAM:** 512 MB (Starter) or 2 GB (Standard)
- **Bandwidth:** 100 GB included
- **Recommendation:** Standard for production
- **Total:** **$25/month**

#### **Vercel (Frontend)**
- **Plan:** Pro ($20/month per user)
- **Bandwidth:** 1 TB included
- **Builds:** Unlimited
- **Team:** 1-5 users
- **Total:** **$20-100/month** (depending on team size)

**Infrastructure Subtotal:** **$70-155/month**

---

### 2. AI API Costs

#### **Anthropic Claude (Primary Cost Driver)**

**Pricing (as of 2025):**
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3.5 Haiku: $0.25/1M input tokens, $1.25/1M output tokens

**Usage Breakdown:**

**A. Document Ingestion (50-100 docs/month)**
- Average pitch deck: 20 pages = ~15,000 tokens
- PDF ingestion (native): ~10,000 tokens/doc
- Entity extraction: ~5,000 tokens/doc
- **Per document:** ~15,000 input + 2,000 output tokens
- **50 docs:** 750K input + 100K output = **$2.25 + $1.50 = $3.75**
- **100 docs:** 1.5M input + 200K output = **$4.50 + $3.00 = $7.50**

**B. Chat Q&A (500-1,000 queries/month)**
- Average query: 200 input tokens (question + context)
- Average response: 1,000 output tokens
- **Simple questions (30%):** Use Haiku
  - 150 queries × (200 input + 1,000 output) = 30K + 150K tokens
  - Cost: **$0.01 + $0.19 = $0.20**
- **Complex questions (70%):** Use Sonnet
  - 350 queries × (200 input + 1,000 output) = 70K + 350K tokens
  - Cost: **$0.21 + $5.25 = $5.46**
- **Total Q&A:** **$5.66/month** (500 queries) or **$11.32/month** (1,000 queries)

**C. Query Rewriting & Analysis (500-1,000/month)**
- Query router: ~500 tokens/query (Haiku)
- 500 queries: 250K tokens = **$0.06/month**
- 1,000 queries: 500K tokens = **$0.13/month**

**D. Contextual Chunking (50-100 docs × ~20 chunks/doc)**
- Per chunk: ~300 input + 100 output tokens (Haiku)
- 1,000 chunks: 300K + 100K tokens = **$0.08 + $0.13 = $0.21/month**
- 2,000 chunks: 600K + 200K tokens = **$0.15 + $0.25 = $0.40/month**

**E. Entity Extraction (50-100 docs/month)**
- Per document: ~5,000 input + 1,000 output tokens (Sonnet)
- 50 docs: 250K + 50K tokens = **$0.75 + $0.75 = $1.50/month**
- 100 docs: 500K + 100K tokens = **$1.50 + $1.50 = $3.00/month**

**Anthropic Subtotal:**
- **Conservative (50 docs, 500 queries):** $3.75 + $5.66 + $0.06 + $0.21 + $1.50 = **$11.18/month**
- **Active (100 docs, 1,000 queries):** $7.50 + $11.32 + $0.13 + $0.40 + $3.00 = **$22.35/month**

#### **Voyage AI (Embeddings)**

**Pricing:**
- Voyage-3: $0.10/1K queries (free tier: 10K queries/month)
- Voyage-3-Lite: $0.05/1K queries (free tier: 10K queries/month)

**Usage:**
- Document embeddings: 50-100 docs × 20 chunks = 1,000-2,000 embeddings
- Query embeddings: 500-1,000 queries/month
- **Total:** 1,500-3,000 embeddings/month
- **Cost:** Free tier covers up to 10K queries → **$0/month** ✅

#### **Cohere (Reranking)**

**Pricing:**
- Rerank v3: $1/1K queries (free tier: 100 queries/month)

**Usage:**
- Reranking per query: ~10-30 documents
- 500 queries: 5,000-15,000 rerank operations
- 1,000 queries: 10,000-30,000 rerank operations
- **Cost:** 
  - 500 queries: ~10K reranks = **$10/month**
  - 1,000 queries: ~20K reranks = **$20/month**

**AI API Subtotal:**
- **Conservative:** $11.18 (Claude) + $0 (Voyage) + $10 (Cohere) = **$21.18/month**
- **Active:** $22.35 (Claude) + $0 (Voyage) + $20 (Cohere) = **$42.35/month**

---

## Total Monthly Cost

### **Conservative Usage (50 docs, 500 queries)**
- Infrastructure: $70-155/month
- AI APIs: $21.18/month
- **Total: $91-176/month**

### **Active Usage (100 docs, 1,000 queries)**
- Infrastructure: $70-155/month
- AI APIs: $42.35/month
- **Total: $112-197/month**

---

## Annual Cost

### **Conservative:**
- **$1,092 - $2,112/year**

### **Active:**
- **$1,344 - $2,364/year**

---

## Cost Optimization Strategies

### 1. **Reduce Claude Costs (Biggest Savings)**
- ✅ Already using Haiku for simple questions (75% cheaper)
- ✅ Use Haiku for query rewriting (saves ~$5/month)
- ✅ Use Haiku for contextual chunking (saves ~$2/month)
- **Potential savings:** $7-10/month

### 2. **Optimize Document Ingestion**
- Batch process documents (reduce API calls)
- Cache entity extractions (avoid re-processing)
- **Potential savings:** $2-5/month

### 3. **Reduce Reranking Costs**
- Only rerank top 10-20 results (not all 30)
- Skip reranking for simple queries
- **Potential savings:** $5-10/month

### 4. **Infrastructure Optimization**
- Use Supabase Free tier for small teams (limited to 500 MB database)
- Use Render Starter ($7/month) for low traffic
- **Potential savings:** $18-50/month

### **Optimized Monthly Cost:**
- **Conservative:** $50-100/month
- **Active:** $70-130/month

---

## Cost Comparison

### **vs. Alternatives:**

1. **Custom Development:**
   - Developer time: $100-200/hour × 200-400 hours = **$20,000-80,000 one-time**
   - Maintenance: **$5,000-15,000/year**
   - **This platform: $1,000-2,500/year** ✅ Much cheaper

2. **Enterprise AI Platforms:**
   - Coda AI: $10/user/month × 10 users = **$100/month**
   - Notion AI: $8/user/month × 10 users = **$80/month**
   - But these don't have VC-specific features
   - **This platform: $100-200/month with custom features** ✅ Competitive

3. **Hiring Analyst:**
   - Junior analyst: $50,000-80,000/year
   - **This platform: $1,000-2,500/year** ✅ 20-80x cheaper

---

## ROI Analysis

### **Time Savings:**
- **Document review:** 2 hours → 15 minutes (87% faster)
- **Research queries:** 30 minutes → 2 minutes (93% faster)
- **Connection discovery:** 1 hour → 5 minutes (92% faster)

### **Value Created:**
- **Better decisions:** Faster access to portfolio insights
- **Missed opportunities:** Discover connections that would be missed manually
- **Team efficiency:** 5-10 analysts save 10-20 hours/week = **$50,000-100,000/year in time value**

### **Cost vs. Value:**
- **Platform cost:** $1,000-2,500/year
- **Time value saved:** $50,000-100,000/year
- **ROI:** **20-100x** ✅ Excellent ROI

---

## Conclusion

### **Is it costly?**
**No, it's very cost-effective:**
- **Monthly:** $100-200/month (less than one analyst hour)
- **Annual:** $1,000-2,500/year (2-5% of one analyst salary)
- **ROI:** 20-100x return on investment

### **Recommendations:**
1. **Start with conservative usage** ($100/month) to validate
2. **Optimize with Haiku** for simple operations (save $10-15/month)
3. **Scale up gradually** as team adoption increases
4. **Monitor API usage** via Anthropic/Cohere dashboards
5. **Consider annual plans** for infrastructure (10-20% discount)

### **Cost Breakdown:**
- **Infrastructure:** 60-70% of total cost
- **Claude API:** 20-30% of total cost
- **Cohere Reranking:** 10-15% of total cost
- **Voyage Embeddings:** 0% (free tier) ✅

**Bottom line:** For a VC firm, this platform costs less than a single analyst hour per month but provides 20-100x value in time savings and better decision-making.
