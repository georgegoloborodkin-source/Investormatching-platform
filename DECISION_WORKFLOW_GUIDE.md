# Decision Logger & Decision Engine: User Guide for Investment Teams

## Overview

The **Decision Logger** and **Decision Engine** are two complementary tabs that help investment teams:
1. **Capture decisions** systematically (Decision Logger)
2. **Analyze patterns** and gain insights (Decision Engine)

---

## 📝 Decision Logger Tab

### Purpose
**Log every investment decision** your team makes in a structured, searchable format. This creates the data foundation for pattern analysis.

### How Investment Team Members Use It

#### **1. Logging a New Decision**

**Scenario:** A partner just had a meeting with a startup and wants to record the outcome.

**Steps:**
1. Click **"Log New Decision"** button
2. Fill in the form:
   - **Actor** (required): Who made the decision? 
     - Example: "Sarah Chen", "Partner A", "John Smith"
   - **Action Type** (required): What happened?
     - Options: `intro`, `meeting`, `follow_up`, `due_diligence`, `pass`, `invest`
   - **Startup Name** (required): Which company?
     - Example: "Acme AI", "TechCorp Inc"
   - **Sector** (optional): Industry vertical
     - Example: "SaaS", "Fintech", "Healthcare"
   - **Stage** (optional): Funding stage
     - Example: "Seed", "Series A", "Pre-seed"
   - **Geography** (optional): Location
     - Example: "US", "Europe", "Asia"
   - **Confidence Score** (slider): How confident are you?
     - Range: 0-100 (default: 70)
   - **Outcome** (dropdown): Final decision
     - Options: `pending`, `positive`, `negative`, `neutral`
   - **Notes** (optional): Additional context
     - Example: "Strong team, but market timing concerns"
   - **Attach Document** (optional): Link to source document
     - Can select from existing documents or upload new

3. Click **"Save Decision"**

**Result:** Decision is saved to the database and appears in the decision history list.

---

#### **2. Quick Log from Document**

**Scenario:** A team member just uploaded a pitch deck and wants to immediately log a decision about it.

**Steps:**
1. Upload document in **Sources** tab (or view existing document)
2. Click **"Log Decision"** button in document viewer
3. Form auto-fills with:
   - Startup name (from extracted data)
   - Sector (from extracted data)
   - Stage (from extracted data)
   - Document attached automatically
4. Fill in remaining fields (Actor, Action Type, Outcome, etc.)
5. Click **"Save Decision"**

**Result:** Decision is linked to the source document for full traceability.

---

#### **3. Viewing Decision History**

**Features:**
- **Stats Overview**: See totals, average confidence, positive outcomes, active actors
- **Filter by Document**: Dropdown to show only decisions linked to a specific document
- **Decision List**: Chronological list showing:
  - Actor name
  - Action type (badge)
  - Startup name
  - Outcome (badge: pending/positive/negative/neutral)
  - Confidence score
  - Timestamp
  - Link to source document (if attached)

**Use Cases:**
- Review all decisions for a specific startup
- See which partner made which decisions
- Track follow-up actions after meetings
- Export to CSV for external analysis

---

#### **4. Updating Outcomes**

**Scenario:** A decision was logged as "pending" but now has a final outcome.

**Steps:**
1. Find the decision in the list
2. Click the outcome badge (e.g., "pending")
3. Select new outcome: `positive`, `negative`, `neutral`
4. Outcome updates immediately

**Result:** Decision history reflects the final outcome for pattern analysis.

---

#### **5. Deleting Decisions**

**Scenario:** A decision was logged by mistake.

**Steps:**
1. Find the decision in the list
2. Click delete button (trash icon)
3. Confirm deletion

**Result:** Decision is removed from history.

---

#### **6. Exporting Data**

**Scenario:** Team wants to analyze decisions in Excel or share with external stakeholders.

**Steps:**
1. Click **"Export CSV"** button
2. CSV file downloads with all decision data:
   - Actor, Action Type, Startup Name, Sector, Stage, Geo
   - Confidence Score, Outcome, Notes
   - Timestamp, Document ID

**Result:** Spreadsheet ready for analysis.

---

### Key Features

✅ **Auto-fill from documents**: When logging from a document, startup name/sector/stage are pre-filled  
✅ **Document linking**: Every decision can be linked to a source document (pitch deck, memo, etc.)  
✅ **Filter by document**: See all decisions related to a specific document  
✅ **Team-wide visibility**: All team members in the same organization can see decisions  
✅ **Outcome tracking**: Update outcomes as decisions evolve  
✅ **CSV export**: Export all data for external analysis

---

## 📊 Decision Engine Tab

### Purpose
**Analyze patterns** across all logged decisions to discover insights, trends, and opportunities.

### How Investment Team Members Use It

#### **1. Overview Dashboard**

**What You See:**
- **Total Decisions Logged**: Count of all decisions
- **Average Confidence**: Mean confidence score across all decisions
- **Positive Outcomes**: Count of decisions with positive outcomes
- **Unique Actors**: Number of different team members who logged decisions

**Use Case:** Quick health check of decision data quality and volume.

---

#### **2. Pattern Discovery Cards**

**What They Show:**
- **Intro Timing Effects**: When intros happen vs. when they convert
- **Partner Attention Drift**: Which partners focus on which sectors
- **Peer Signal Reversal**: Cases where a "pass" later became an "invest"
- **Warm Intro Lift**: Conversion rate of warm vs. cold intros

**Status Indicators:**
- **"Live"**: Pattern is computed (requires 20+ decisions)
- **"Needs data"**: Not enough decisions yet to compute pattern

**Use Cases:**
- Identify which partners are most effective in which sectors
- Discover timing patterns (e.g., "Q4 intros convert better")
- Find missed opportunities (pass → invest reversals)
- Optimize intro strategy (warm vs. cold)

---

#### **3. Decision Graph Visualization**

**What It Shows:**
- **Nodes**: Entities in the decision network
  - Founder, Startup, Investor, Partner, Intro, Meeting, Outcome
- **Edges**: Relationships between nodes
  - Introduced, Met, Followed up, Passed, Invested

**Use Case:** Visual representation of the decision network for pattern recognition.

---

#### **4. Phase Roadmap**

**Phase 1: Decision Graph** (Current)
- Structured data capture
- Cross-fund pattern visibility
- Cost: Near zero

**Phase 2: Scored Decisions** (Future)
- Win-rate by partner/sector
- Statistical analysis
- Cost: Low

**Phase 3: Lightweight Learning** (Future)
- ML models (logistic/Bayesian/bandits)
- Ranked decisions + alerts
- Cost: <$5k/month

**Use Case:** Understand the evolution path and what insights become available as data grows.

---

### Key Insights Available

✅ **Partner Performance**: Which partners have highest win rates in which sectors  
✅ **Sector Trends**: Which sectors are getting more attention vs. more investments  
✅ **Timing Patterns**: When in the year/quarter do intros convert best  
✅ **Network Effects**: Which intros lead to meetings, which meetings lead to investments  
✅ **Confidence Calibration**: Are high-confidence decisions actually converting?

---

## 🔄 Typical Workflow

### **Daily Workflow for Investment Team**

1. **Morning**: Review Decision Engine dashboard
   - Check latest patterns
   - See if any new insights emerged

2. **During Day**: Log decisions as they happen
   - After a meeting → Log "meeting" decision
   - After reviewing a pitch deck → Log "intro" decision
   - After making a final call → Log "pass" or "invest" decision

3. **End of Week**: Review Decision Logger
   - Filter by document to see all decisions for a specific startup
   - Update outcomes for pending decisions
   - Export CSV for weekly team review

4. **Monthly**: Deep dive in Decision Engine
   - Analyze partner performance patterns
   - Identify sector trends
   - Review timing effects

---

## 🎯 Best Practices

### **For Decision Logger:**

1. **Log immediately**: Don't wait—log decisions right after they happen
2. **Be consistent**: Use the same actor names (e.g., always "Sarah Chen" not "Sarah" or "S. Chen")
3. **Attach documents**: Link decisions to source documents for full context
4. **Update outcomes**: Change "pending" to final outcomes when decisions are made
5. **Add notes**: Include context that might be useful later (e.g., "Strong team, but market timing concerns")

### **For Decision Engine:**

1. **Wait for data**: Patterns need 20+ decisions to be meaningful
2. **Review regularly**: Check patterns weekly/monthly as data accumulates
3. **Share insights**: Use patterns to inform team strategy discussions
4. **Track changes**: Monitor how patterns evolve as more decisions are logged

---

## 🔐 Privacy & Access

- **Organization-level**: All team members in the same organization can see all decisions
- **Event-level**: Decisions are scoped to events (funds/deals)
- **Actor-level**: Users can see who made each decision
- **Document linking**: Decisions linked to documents respect document access permissions

---

## 📈 Success Metrics

**Decision Logger Success:**
- ✅ 100% of meetings logged within 24 hours
- ✅ All decisions have actor, action type, and outcome
- ✅ 80%+ of decisions linked to source documents

**Decision Engine Success:**
- ✅ Patterns become "Live" (20+ decisions)
- ✅ Team uses patterns to inform strategy
- ✅ Partner performance insights drive resource allocation

---

## 🚀 Future Enhancements

**Planned Features:**
- Real-time alerts when patterns change
- Partner performance leaderboards
- Sector trend charts
- Automated decision recommendations
- Integration with CRM systems

---

## Questions?

If you need help:
1. Check the **Dashboard** tab for quick stats
2. Review **Decision Logger** history to see examples
3. Contact your team admin for access/permissions
