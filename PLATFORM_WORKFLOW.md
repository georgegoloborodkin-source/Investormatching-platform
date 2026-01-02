# Platform Workflow: Visual Guide

## 🔄 Complete User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT ORGANIZER WORKFLOW                    │
└─────────────────────────────────────────────────────────────────┘

STEP 1: SETUP
┌──────────────┐
│ Create Event │
│ - Name       │
│ - Date       │
│ - Time Slots │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Add Investors│
│ - Firm info  │
│ - Preferences│
│ - Capacity   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Add Startups │
│ - Company    │
│ - Industry   │
│ - Funding    │
└──────┬───────┘
       │
       ▼
┌─────────────────┐
│ Generate Matches│
│ (Algorithm runs)│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Review Schedule │
│ - Check matches │
│ - Adjust if needed│
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Export & Share  │
│ - CSV export    │
│ - Send schedules│
└─────────────────┘
```

---

## 🎯 Matching Algorithm Flow

```
STARTUPS                    INVESTORS
   │                           │
   │                           │
   ▼                           ▼
┌─────────────────────────────────────┐
│   COMPATIBILITY SCORING             │
│                                     │
│   For each Startup-Investor pair:   │
│                                     │
│   1. Geographic Match (40%)         │
│      └─> Market overlap?            │
│                                     │
│   2. Industry Match (25%)          │
│      └─> Industry in preferences?   │
│                                     │
│   3. Stage Match (20%)              │
│      └─> Stage in preferences?     │
│                                     │
│   4. Funding Match (15%)            │
│      └─> Target in ticket range?   │
│                                     │
│   = Total Compatibility Score       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   FAIR DISTRIBUTION                 │
│                                     │
│   - Calculate total slots           │
│   - Divide by startups              │
│   - Ensure minimum per startup      │
│   - Distribute extras fairly        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   TIME SLOT ASSIGNMENT              │
│                                     │
│   - Assign to available slots       │
│   - Prevent conflicts               │
│   - Respect availability            │
│   - Optimize schedule               │
└──────────────┬──────────────────────┘
               │
               ▼
         FINAL SCHEDULE
```

---

## 👥 Role-Based Views

### ORGANIZER VIEW (Current)
```
┌─────────────────────────────────────────┐
│  MATCHMAKING DASHBOARD                 │
├─────────────────────────────────────────┤
│                                         │
│  [Manage] [Time Slots] [Overview]     │
│  [Table View] [Edit Schedule]           │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Manage Participants             │   │
│  │ - Add/Edit Startups             │   │
│  │ - Add/Edit Investors            │   │
│  │ - Import CSV                    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Generated Matches               │   │
│  │ - View all matches              │   │
│  │ - Edit schedule                 │   │
│  │ - Lock/Unlock matches           │   │
│  │ - Mark completed                │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Generate Matches] [Rematch] [Export] │
└─────────────────────────────────────────┘
```

### INVESTOR VIEW (Future)
```
┌─────────────────────────────────────────┐
│  MY SCHEDULE                            │
├─────────────────────────────────────────┤
│                                         │
│  Today's Meetings: 4                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 09:00 - 09:20                    │   │
│  │ TechFlow AI                       │   │
│  │ Industry: AI/ML                   │   │
│  │ Stage: Series A                  │   │
│  │ Compatibility: 95%               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 09:20 - 09:40                    │   │
│  │ HealthVision                     │   │
│  │ Industry: Healthtech            │   │
│  │ Stage: Seed                      │   │
│  │ Compatibility: 88%               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Export Calendar] [Add Notes]          │
└─────────────────────────────────────────┘
```

### STARTUP VIEW (Future)
```
┌─────────────────────────────────────────┐
│  MY SCHEDULE                            │
├─────────────────────────────────────────┤
│                                         │
│  Today's Meetings: 3                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 09:00 - 09:20                    │   │
│  │ VC Partners                      │   │
│  │ Table: A1                        │   │
│  │ Focus: AI/ML, SaaS               │   │
│  │ Ticket: $1M-$5M                  │   │
│  │ Compatibility: 95%               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 09:40 - 10:00                    │   │
│  │ Health Innovations Fund          │   │
│  │ Table: B3                        │   │
│  │ Focus: Healthtech                │   │
│  │ Ticket: $250K-$2M                │   │
│  │ Compatibility: 88%               │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Export Calendar] [Add Notes]          │
└─────────────────────────────────────────┘
```

---

## 📊 Data Flow

```
┌─────────────┐
│   INPUT     │
│             │
│ Startups    │
│ Investors   │
│ Time Slots  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  MATCHING       │
│  ALGORITHM      │
│                 │
│  - Calculate    │
│    scores       │
│  - Distribute   │
│    fairly       │
│  - Assign slots │
└──────┬──────────┘
       │
       ▼
┌─────────────┐
│   OUTPUT    │
│             │
│ Matches     │
│ Schedule    │
│ CSV Export  │
└─────────────┘
```

---

## 🔄 Event Lifecycle

```
EVENT CREATION
      │
      ▼
PARTICIPANT REGISTRATION
      │
      ▼
DATA COLLECTION
      │
      ▼
MATCH GENERATION
      │
      ▼
SCHEDULE REVIEW
      │
      ▼
EXPORT & SHARE
      │
      ▼
EVENT EXECUTION
      │
      ▼
TRACKING & COMPLETION
      │
      ▼
POST-EVENT ANALYSIS
```

---

## 💡 Key Interactions

### Organizer Actions:
1. ✅ **Add Participants** - Manual entry or CSV import
2. ✅ **Configure Time Slots** - Set meeting windows
3. ✅ **Generate Matches** - Run algorithm
4. ✅ **Review Schedule** - Check all matches
5. ✅ **Manual Adjustments** - Lock, edit, delete matches
6. ✅ **Rematch** - Regenerate schedule
7. ✅ **Export** - Share with participants
8. ✅ **Track Progress** - Mark meetings completed

### Investor Actions (Future):
1. 🔄 **View Schedule** - See own meetings only
2. 🔄 **Review Matches** - See startup details
3. 🔄 **Mark Attendance** - Confirm participation
4. 🔄 **Add Notes** - Post-meeting feedback
5. 🔄 **Export Calendar** - Add to personal calendar

### Startup Actions (Future):
1. 🔄 **View Schedule** - See own meetings only
2. 🔄 **Review Matches** - See investor details
3. 🔄 **Mark Attendance** - Confirm participation
4. 🔄 **Add Notes** - Post-meeting feedback
5. 🔄 **Export Calendar** - Add to personal calendar

---

## 🎯 Matching Example

### Input:
- **20 Startups** (various industries, stages, funding needs)
- **10 Investors** (different preferences, ticket sizes)
- **6 Time Slots** (2 hours total)

### Algorithm Process:
1. Calculate 200 possible pairs (20 × 10)
2. Score each pair (0-100%)
3. Sort by compatibility
4. Distribute fairly (each startup gets ~3 meetings)
5. Assign to time slots (avoid conflicts)
6. Optimize schedule

### Output:
- **60 Matches** total
- **3 meetings per startup** (fair distribution)
- **6 meetings per investor** (within capacity)
- **No scheduling conflicts**
- **High compatibility scores** (average 75%+)

---

## 📈 Success Metrics

### For Organizers:
- ⏱️ **Time Saved**: 80% reduction vs. manual scheduling
- ✅ **Match Quality**: Average 75%+ compatibility
- ⚖️ **Fairness**: All startups get meetings
- 🎯 **Efficiency**: Zero conflicts

### For Participants:
- 📅 **Clear Schedule**: Know exactly when/where
- 🎯 **Quality Matches**: Meet relevant partners
- ⏰ **Time Optimized**: No wasted meetings
- 📊 **Transparency**: See why matched

---

## 🔑 Key Concepts

### Compatibility Score
- **0-100%** rating of how well startup-investor match
- Based on: Geography, Industry, Stage, Funding
- Higher = better match

### Fair Distribution
- Every startup gets roughly equal meetings
- Algorithm ensures minimum meetings for all
- Prevents some startups from being left out

### Round-Robin
- Each startup meets multiple investors
- Each investor meets multiple startups
- Rotating schedule format

### Time Slot Management
- Prevents double-booking
- Respects availability
- Optimizes schedule density

---

This visual guide complements the detailed explanation in `PLATFORM_EXPLANATION.md`.

