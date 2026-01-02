import { Investor, Match, Startup, TimeSlotConfig } from "@/types";

type BreakdownLine = string;

interface GenerateOptions {
  minMeetingsPerInvestor?: number; // default 0
  memberNameFilter?: string[]; // if provided, only these memberNames (case-insensitive) are eligible
  maxMeetingsPerStartup?: number; // default 1 (coverage-first)
}

interface ScoredCandidate {
  startup: Startup;
  investor: Investor;
  score: number;
  breakdown: BreakdownLine[];
}

const DEFAULT_TIME_SLOTS = [
  "09:00 - 09:20",
  "09:20 - 09:40",
  "09:40 - 10:00",
  "10:00 - 10:20",
  "10:20 - 10:40",
  "10:40 - 11:00",
  "11:00 - 11:20",
  "11:20 - 11:40",
  "11:40 - 12:00",
  "12:00 - 12:20",
  "12:20 - 12:40",
  "12:40 - 13:00",
  "13:00 - 13:20",
  "13:20 - 13:40",
  "13:40 - 14:00",
  "14:00 - 14:20",
  "14:20 - 14:40",
  "14:40 - 15:00",
  "15:00 - 15:20",
  "15:20 - 15:40",
  "15:40 - 16:00",
  "16:00 - 16:20",
  "16:20 - 16:40",
  "16:40 - 17:00",
  "17:00 - 17:20",
  "17:20 - 17:40",
  "17:40 - 18:00",
];

function norm(s: string): string {
  return (s || "").trim().toLowerCase();
}

function startupNameKey(startup: Startup): string {
  // Additional guard: if the same startup is accidentally imported twice (different IDs, same name),
  // we still don't want duplicate-looking rows in the schedule.
  return norm(startup.companyName);
}

function investorMemberKey(investor: Investor): string {
  return norm(investor.memberName);
}

function geoOverlap(startup: Startup, investor: Investor): string[] {
  const investorSet = new Set(investor.geoFocus.map(norm));
  return startup.geoMarkets.filter((m) => investorSet.has(norm(m)));
}

function industryMatches(startup: Startup, investor: Investor): boolean {
  const invSet = new Set(investor.industryPreferences.map(norm));
  return invSet.has(norm(startup.industry));
}

function stageMatches(startup: Startup, investor: Investor): boolean {
  const invSet = new Set(investor.stagePreferences.map(norm));
  return invSet.has(norm(startup.fundingStage));
}

/**
 * MVP hard filters (NON-NEGOTIABLE):
 * 1) industry match
 * 2) geo overlap non-empty
 * 3) funding target within ticket range
 */
function passesHardFilters(startup: Startup, investor: Investor): boolean {
  if (!industryMatches(startup, investor)) return false;
  if (geoOverlap(startup, investor).length === 0) return false;
  if (startup.fundingTarget < investor.minTicketSize) return false;
  if (startup.fundingTarget > investor.maxTicketSize) return false;
  return true;
}

/**
 * MVP scoring (ONLY after hard filters pass).
 * Max score = 100.
 *
 * - Industry match: +30 (fixed)
 * - Geo overlap: +20 (fixed)
 * - Funding proximity to midpoint of ticket range: +0..+20
 * - Stage alignment: +0 or +15
 * - Investor has remaining slots: +15 (fixed, given remainingSlots>0 at selection time)
 */
function scoreCandidate(
  startup: Startup,
  investor: Investor,
  remainingSlots: number
): { score: number; breakdown: BreakdownLine[]; topReason: string } {
  const breakdown: BreakdownLine[] = [];

  const components: { label: string; points: number }[] = [];

  // Hard-filtered facts
  components.push({ label: `Industry match (${startup.industry})`, points: 30 });
  const overlap = geoOverlap(startup, investor);
  components.push({ label: `Geo overlap (${overlap.join(", ")})`, points: 20 });

  // Funding midpoint proximity
  const min = investor.minTicketSize;
  const max = investor.maxTicketSize;
  const mid = (min + max) / 2;
  const halfRange = Math.max(1, (max - min) / 2); // avoid divide by zero
  const distance = Math.abs(startup.fundingTarget - mid);
  const closeness = Math.max(0, 1 - distance / halfRange); // 1 at midpoint, 0 at ends
  const fundingPoints = Math.round(20 * closeness);
  components.push({
    label: `Ticket fit (target ${startup.fundingTarget.toLocaleString()} within ${min.toLocaleString()}–${max.toLocaleString()})`,
    points: fundingPoints,
  });

  // Stage alignment (not a hard filter in MVP spec)
  const stagePoints = stageMatches(startup, investor) ? 15 : 0;
  components.push({ label: `Stage alignment (${startup.fundingStage})`, points: stagePoints });

  // Remaining slots
  const slotPoints = remainingSlots > 0 ? 15 : 0;
  components.push({ label: `Slots available`, points: slotPoints });

  const score = components.reduce((sum, c) => sum + c.points, 0);
  const maxComp = components.reduce((best, c) => (c.points > best.points ? c : best), components[0]);
  const topReason = maxComp ? `${maxComp.label} (+${maxComp.points})` : "Balanced match";
  // Per request: hide breakdown content, return only score and topReason metadata
  return { score, breakdown, topReason };
}

function buildSlots(timeSlots: TimeSlotConfig[]) {
  const slotsToUse =
    timeSlots.length > 0
      ? timeSlots.map((ts) => `${ts.startTime} - ${ts.endTime}`)
      : DEFAULT_TIME_SLOTS;

  const slotLabels =
    timeSlots.length > 0 ? timeSlots.map((ts) => ts.label) : slotsToUse.map((_, i) => `Slot ${i + 1}`);

  return { slotsToUse, slotLabels };
}

function isAvailableForSlot(entity: Startup | Investor, slotId?: string): boolean {
  if (!slotId) return true;
  if (!entity.slotAvailability) return true;
  return entity.slotAvailability[slotId] !== false;
}

function makeInvestorDisplayName(investor: Investor): string {
  return `${investor.firmName} (${investor.memberName})`;
}

function investorFirmKey(investor: Investor): string {
  // MVP assumption: you should NOT match a startup to the same firm multiple times,
  // even if the CSV has multiple rows (multiple members) for that firm.
  return norm(investor.firmName);
}

/**
 * MVP Generate Matches
 * - No duplicates (startup_id, investor_id) pairs
 * - Strict investor slot capacity
 * - Hard filters enforced
 * - Score threshold enforced (>=70)
 * - Includes scoreBreakdown lines
 */
export function generateMatches(
  startups: Startup[],
  investors: Investor[],
  existingMatches: Match[] = [],
  timeSlots: TimeSlotConfig[] = [],
  options: GenerateOptions = {}
): Match[] {
  const minMeetingsPerInvestor = options.minMeetingsPerInvestor ?? 0;
  const memberNameFilter = (options.memberNameFilter || []).map(norm);
  const filterByMember = memberNameFilter.length > 0;
  const maxMeetingsPerStartup = options.maxMeetingsPerStartup ?? 1; // coverage-first cap

  // Keep only attending
  const availableStartupsRaw = startups.filter((s) => s.availabilityStatus === "present");
  const availableInvestors = investors.filter((i) => {
    if (i.availabilityStatus !== "present") return false;
    if (filterByMember) {
      return memberNameFilter.includes(norm(i.memberName));
    }
    return true;
  });

  // Deduplicate startups by normalized name to avoid duplicate-looking entries eating slots
  const startupByName = new Map<string, Startup>();
  for (const s of availableStartupsRaw) {
    const key = startupNameKey(s);
    if (!startupByName.has(key)) {
      startupByName.set(key, s);
    }
  }
  const availableStartups = Array.from(startupByName.values());

  // Build slot helpers
  const { slotsToUse, slotLabels } = buildSlots(timeSlots);

  // Schedule occupancy (to avoid double-booking in a slot)
  const scheduleGrid: Record<
    string,
    {
      startupIds: Set<string>;
      investorIds: Set<string>;
    }
  > = {};
  slotLabels.forEach((label) => {
    scheduleGrid[label] = { startupIds: new Set(), investorIds: new Set() };
  });

  // Preserve completed/locked matches ONLY if they still pass hard filters, and count them toward slots.
  // This avoids MVP violations (industry/geo/ticket mismatches) lingering in output.
  const preservedRaw = existingMatches.filter((m) => m.completed || m.locked);
  const preserved: Match[] = [];
  const usedPairs = new Set<string>();
  const usedFirmPairs = new Set<string>(); // startupId::firmKey
  const usedNamePairs = new Set<string>(); // startupName::firmName::memberName (prevents duplicate-looking rows)
  const investorUsedCount = new Map<string, number>();
  const startupUsedCount = new Map<string, number>();

  for (const m of preservedRaw) {
    const startup = availableStartups.find((s) => s.id === m.startupId);
    const investor = availableInvestors.find((i) => i.id === m.investorId);
    if (!startup || !investor) continue;

    if (!passesHardFilters(startup, investor)) continue;

    const key = `${startup.id}::${investor.id}`;
    if (usedPairs.has(key)) continue;
    const firmKey = `${startup.id}::${investorFirmKey(investor)}`;
    if (usedFirmPairs.has(firmKey)) continue;
    const nameKey = `${startupNameKey(startup)}::${investorFirmKey(investor)}::${investorMemberKey(investor)}`;
    if (usedNamePairs.has(nameKey)) continue;

    const used = investorUsedCount.get(investor.id) || 0;
    if (used >= investor.totalSlots) continue;
    const su = startupUsedCount.get(startup.id) || 0;
    if (su >= maxMeetingsPerStartup) continue;

    // Reserve the existing slot if it exists in this run
    if (m.timeSlot && scheduleGrid[m.timeSlot]) {
      scheduleGrid[m.timeSlot].startupIds.add(startup.id);
      scheduleGrid[m.timeSlot].investorIds.add(investor.id);
    }

    const { score, breakdown } = scoreCandidate(startup, investor, investor.totalSlots - used);
    if (score < 70) continue;

    preserved.push({
      ...m,
      startupName: startup.companyName,
      investorName: makeInvestorDisplayName(investor),
      compatibilityScore: score,
      scoreBreakdown: breakdown,
    });

    usedPairs.add(key);
    usedFirmPairs.add(firmKey);
    usedNamePairs.add(nameKey);
    investorUsedCount.set(investor.id, used + 1);
    startupUsedCount.set(startup.id, su + 1);
  }

  // Build scored candidates grouped per startup for fairness-first allocation
  const candidatesByStartup = new Map<string, ScoredCandidate[]>();

  for (const investor of availableInvestors) {
    const alreadyUsed = investorUsedCount.get(investor.id) || 0;
    const remainingSlots = Math.max(0, investor.totalSlots - alreadyUsed);
    if (remainingSlots <= 0) continue;

    for (const startup of availableStartups) {
      const key = `${startup.id}::${investor.id}`;
      if (usedPairs.has(key)) continue;
      const firmKey = `${startup.id}::${investorFirmKey(investor)}`;
      if (usedFirmPairs.has(firmKey)) continue;
      const nameKey = `${startupNameKey(startup)}::${investorFirmKey(investor)}::${investorMemberKey(investor)}`;
      if (usedNamePairs.has(nameKey)) continue;

      if (!passesHardFilters(startup, investor)) continue;

      const { score, breakdown } = scoreCandidate(startup, investor, remainingSlots);
      if (score < 70) continue;

      const bucket = candidatesByStartup.get(startup.id) || [];
      bucket.push({
        startup,
        investor,
        score,
        breakdown,
      });
      candidatesByStartup.set(startup.id, bucket);
    }
  }

  // Helper to try to assign a candidate with earliest available slot
  function tryAssignCandidate(cand: ScoredCandidate): Match | null {
    const { startup, investor, score, breakdown } = cand;
    const key = `${startup.id}::${investor.id}`;
    if (usedPairs.has(key)) return null;
    const firmKey = `${startup.id}::${investorFirmKey(investor)}`;
    if (usedFirmPairs.has(firmKey)) return null;
    const nameKey = `${startupNameKey(startup)}::${investorFirmKey(investor)}::${investorMemberKey(investor)}`;
    if (usedNamePairs.has(nameKey)) return null;
    const startupCount = startupUsedCount.get(startup.id) || 0;
    if (startupCount >= maxMeetingsPerStartup) return null;

    let assignedTimeSlot = "";
    let assignedSlotTime = "";

    for (let i = 0; i < slotLabels.length; i++) {
      const slotLabel = slotLabels[i];
      const slotTime = slotsToUse[i];
      const slotConfigId = timeSlots[i]?.id;
      const isSlotDone = timeSlots[i]?.isDone === true;
      if (isSlotDone) continue;

      const cell = scheduleGrid[slotLabel];
      if (cell.startupIds.has(startup.id)) continue;
      if (cell.investorIds.has(investor.id)) continue;

      if (!isAvailableForSlot(startup, slotConfigId)) continue;
      if (!isAvailableForSlot(investor, slotConfigId)) continue;

      assignedTimeSlot = slotLabel;
      assignedSlotTime = slotTime || "";
      cell.startupIds.add(startup.id);
      cell.investorIds.add(investor.id);
      break;
    }

    if (!assignedTimeSlot) return null;

    const match: Match = {
      id: `match-${startup.id}-${investor.id}-${Date.now()}-${Math.random()}`,
      startupId: startup.id,
      investorId: investor.id,
      startupName: startup.companyName,
      investorName: makeInvestorDisplayName(investor),
      timeSlot: assignedTimeSlot,
      slotTime: assignedSlotTime,
      compatibilityScore: score,
      status: "upcoming",
      completed: false,
      startupAttending: true,
      investorAttending: true,
      scoreBreakdown: breakdown,
    };

    usedPairs.add(key);
    usedFirmPairs.add(firmKey);
    usedNamePairs.add(nameKey);
    investorUsedCount.set(investor.id, (investorUsedCount.get(investor.id) || 0) + 1);
    startupUsedCount.set(startup.id, startupCount + 1);

    return match;
  }

  const newMatches: Match[] = [];

  // PASS 1: Fairness — give each startup its best available investor (if any slots)
  for (const startup of availableStartups) {
    const list = (candidatesByStartup.get(startup.id) || []).sort((a, b) => b.score - a.score);
    for (const cand of list) {
      const investor = cand.investor;
      const remaining = Math.max(0, investor.totalSlots - (investorUsedCount.get(investor.id) || 0));
      if (remaining <= 0) continue;
      const match = tryAssignCandidate(cand);
      if (match) {
        newMatches.push(match);
        break; // move to next startup
      }
    }
  }

  // Build a flat list of remaining candidates for utilization pass
  const remainingCandidates: ScoredCandidate[] = [];
  for (const bucket of candidatesByStartup.values()) {
    for (const cand of bucket) {
      const investor = cand.investor;
      const remaining = Math.max(0, investor.totalSlots - (investorUsedCount.get(investor.id) || 0));
      if (remaining <= 0) continue;
      const key = `${cand.startup.id}::${cand.investor.id}`;
      if (usedPairs.has(key)) continue;
      remainingCandidates.push(cand);
    }
  }
  remainingCandidates.sort((a, b) => b.score - a.score);

  // PASS 2: Utilization — fill remaining slots by score
  for (const cand of remainingCandidates) {
    const investor = cand.investor;
    const remaining = Math.max(0, investor.totalSlots - (investorUsedCount.get(investor.id) || 0));
    if (remaining <= 0) continue;
    const match = tryAssignCandidate(cand);
    if (match) newMatches.push(match);
  }

  // Optional: ensure min meetings per investor (if configured) — second-chance fill
  if (minMeetingsPerInvestor > 0) {
    for (const investor of availableInvestors) {
      while ((investorUsedCount.get(investor.id) || 0) < minMeetingsPerInvestor) {
        const candidates = remainingCandidates.filter((c) => c.investor.id === investor.id);
        const next = candidates.find((c) => {
          const key = `${c.startup.id}::${c.investor.id}`;
          return !usedPairs.has(key) && (investor.totalSlots - (investorUsedCount.get(investor.id) || 0)) > 0;
        });
        if (!next) break;
        const match = tryAssignCandidate(next);
        if (match) newMatches.push(match);
        else break;
      }
    }
  }

  // Combine and sort by slotTime order for clean output
  const allMatches = [...preserved, ...newMatches];
  const timeIndex = new Map<string, number>();
  slotsToUse.forEach((t, idx) => timeIndex.set(t, idx));

  allMatches.sort((a, b) => {
    const ia = timeIndex.get(a.slotTime) ?? 9999;
    const ib = timeIndex.get(b.slotTime) ?? 9999;
    return ia - ib;
  });

  // Final dedupe guarantee (paranoid)
  const final: Match[] = [];
  const seen = new Set<string>();
  const seenFirm = new Set<string>();
  for (const m of allMatches) {
    const key = `${m.startupId}::${m.investorId}`;
    if (seen.has(key)) continue;
    const investor = investors.find((i) => i.id === m.investorId);
    const firmKey = investor ? `${m.startupId}::${investorFirmKey(investor)}` : `${m.startupId}::${norm(m.investorName)}`;
    if (seenFirm.has(firmKey)) continue;
    seen.add(key);
    seenFirm.add(firmKey);
    final.push(m);
  }

  return final;
}


