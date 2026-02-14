# Next Steps — Sourcing Folders vs Sync Between Team Members

**Two tracks you can work on next.** Pick one based on demo vs product maturity.

---

## Track A: Sourcing Folders

**What you have today**
- Source folders (Portfolio Companies, Investors, Funds, Deals, Market Research, Due Diligence)
- Folder-based card creation (doc in folder → company/fund card)
- Google Drive sync by folder (one root folder, sub-folders per company)
- Document ↔ folder links

**Next steps (sourcing folders)**

1. **“Sourcing companies” folder workflow**
   - Dedicated folder or tag for “companies we’re sourcing” (pre-deal) vs “portfolio” (post-deal).
   - Optional: pipeline stage per folder (e.g. Sourcing → DD → Term Sheet → Portfolio).

2. **Folder templates / presets**
   - Let orgs create custom folders (e.g. “Pre-seed”, “Series A”, “Follow-on”) and optionally map them to stages.

3. **Folder ↔ card status**
   - When a doc moves to a different folder (or folder is renamed), optionally update card status or stage (e.g. “Sourcing” → “Due Diligence”).

4. **Bulk folder assignment**
   - In CIS: select multiple documents and assign to a folder in one action.

**Rough effort:** Small to medium (1–2 weeks for 1–2 items).

---

## Track B: Sync Between Team Members

**What you have today**
- Organization-scoped data: all users in the same org see the same events, documents, decisions, company cards (RLS by `organization_id`).
- Invitations: `InviteAcceptance`, invitation codes, `TeamInvitationForm`, `TeamMembersList`.
- No real-time updates: if User A edits a card, User B sees it only after refresh.

**Next steps (sync between team)**

1. **Real-time or periodic refresh**
   - **Option A (simplest):** “Refresh” button or auto-refresh every N minutes on CIS so team sees each other’s edits.
   - **Option B:** Supabase Realtime subscriptions on `kg_entities`, `documents`, `company_connections` so when someone updates a row, others see it without refresh.

2. **“Last updated by” on cards**
   - Store `updated_by` (and maybe `updated_at`) on company cards / entities; show “Last updated by [Name]” in the UI so the team knows who changed what.

3. **Shared Google Drive sync state**
   - Sync is per event/org; show “Last synced by [Name] at [time]” in Sync Status so the team knows one person’s sync applies to everyone.

4. **Conflict handling (optional, later)**
   - If two people edit the same card at once, either last-write-wins (current behavior) or show a simple “X also edited this; overwrite or merge?” when saving.

**Rough effort:** Small for 1–2 (refresh + “last updated by”); medium for Realtime; larger for conflict UX.

---

## Recommendation

- **If the priority is demo / clarity of workflow:**  
  **Track A (Sourcing folders)** — e.g. “Sourcing companies” folder + one bulk folder assignment. Makes it obvious how folders drive pipeline and cards.

- **If the priority is “we work as a team on the same data”:**  
  **Track B (Sync between team)** — e.g. **auto-refresh or Realtime** + **“Last updated by”** on cards. Little extra work, big perceived improvement for collaboration.

You can do **both** in sequence: e.g. 1–2 sourcing-folder improvements, then 1–2 team-sync improvements.

---

## Quick checklist (copy to your tracker)

**Sourcing folders**
- [ ] Define “Sourcing companies” folder (or tag) and show it in CIS
- [ ] Optional: pipeline stage per folder
- [ ] Bulk assign documents to folder

**Sync between team**
- [ ] Auto-refresh CIS every N min and/or “Refresh” button
- [ ] Optional: Supabase Realtime on key tables
- [ ] “Last updated by [Name]” on company cards
- [ ] “Last synced by [Name]” in Sync Status
