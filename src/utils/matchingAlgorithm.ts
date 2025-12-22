import { Startup, Investor, Match, TimeSlotConfig } from "@/types";

interface CompatibilityScore {
  geoMatch: number;
  industryMatch: number;
  fundingMatch: number;
  stageMatch: number;
  totalScore: number;
}

// Time slots configuration
const TIME_SLOTS = [
  '09:00 - 09:20',
  '09:20 - 09:40', 
  '09:40 - 10:00',
  '10:00 - 10:20',
  '10:20 - 10:40',
  '10:40 - 11:00',
  '11:00 - 11:20',
  '11:20 - 11:40',
  '11:40 - 12:00',
  '12:00 - 12:20',
  '12:20 - 12:40',
  '12:40 - 13:00'
];

export function calculateCompatibilityScore(startup: Startup, investor: Investor): CompatibilityScore {
  // Geographic Match (40% weight) - Calculate overlap percentage
  const geoOverlap = startup.geoMarkets.filter(market => 
    investor.geoFocus.some(focus => focus.toLowerCase() === market.toLowerCase())
  );
  const geoMatch = geoOverlap.length > 0 
    ? (geoOverlap.length / Math.max(startup.geoMarkets.length, investor.geoFocus.length)) * 100 
    : 0;

  // Industry Match (25% weight) - Check if startup industry is in investor preferences
  const industryMatch = investor.industryPreferences.some(pref => 
    pref.toLowerCase() === startup.industry.toLowerCase()
  ) ? 100 : 0;

  // Stage Match (20% weight) - Check if startup stage is in investor preferences
  const stageMatch = investor.stagePreferences.some(pref => 
    pref.toLowerCase() === startup.fundingStage.toLowerCase()
  ) ? 100 : 0;

  // Funding Match (15% weight) - More sophisticated funding alignment
  let fundingMatch = 0;
  const target = startup.fundingTarget;
  const minTicket = investor.minTicketSize;
  const maxTicket = investor.maxTicketSize;

  if (target >= minTicket && target <= maxTicket) {
    // Perfect match - funding target is within investor's range
    fundingMatch = 100;
  } else if (target < minTicket) {
    // Below minimum - calculate proximity score
    const gap = minTicket - target;
    const tolerance = minTicket * 0.3; // 30% tolerance below minimum
    if (gap <= tolerance) {
      fundingMatch = Math.max(20, (1 - gap / tolerance) * 70); // 20-70% score
    }
  } else if (target > maxTicket) {
    // Above maximum - calculate proximity score  
    const gap = target - maxTicket;
    const tolerance = maxTicket * 0.5; // 50% tolerance above maximum
    if (gap <= tolerance) {
      fundingMatch = Math.max(20, (1 - gap / tolerance) * 70); // 20-70% score
    }
  }

  // Calculate weighted total score
  const totalScore = (geoMatch * 0.4) + (industryMatch * 0.25) + (stageMatch * 0.2) + (fundingMatch * 0.15);

  return {
    geoMatch: Math.round(geoMatch),
    industryMatch: Math.round(industryMatch),
    stageMatch: Math.round(stageMatch),
    fundingMatch: Math.round(fundingMatch),
    totalScore: Math.round(Math.max(0, Math.min(100, totalScore)))
  };
}

export function generateMatches(
  startups: Startup[], 
  investors: Investor[], 
  existingMatches: Match[] = [],
  timeSlots: TimeSlotConfig[] = []
): Match[] {
  // Filter out unavailable participants
  const availableStartups = startups.filter(s => s.availabilityStatus === 'present');
  const availableInvestors = investors.filter(i => i.availabilityStatus === 'present');

  // Get completed matches to preserve
  const completedMatches = existingMatches.filter(match => match.completed);
  // Get locked matches - only preserve the pairing, not the time slot
  const lockedMatches = existingMatches.filter(match => match.locked && !match.completed);
  // Only completed matches preserve their time slots unchanged
  const preservedMatches = [...completedMatches];
  
  // Track pairs that have already met (completed or newly scheduled in this run)
  const hasMet = new Set<string>();
  preservedMatches.forEach(m => hasMet.add(`${m.startupId}::${m.investorId}`));

  // Calculate all possible compatibility scores
  const allPossibleMatches: (Match & { score: CompatibilityScore })[] = [];

  availableStartups.forEach(startup => {
    availableInvestors.forEach(investor => {
      // Skip if already have a completed or locked match
      const hasPreservedMatch = preservedMatches.some(
        match => match.startupId === startup.id && match.investorId === investor.id
      );
      
      if (!hasPreservedMatch) {
        const score = calculateCompatibilityScore(startup, investor);
        allPossibleMatches.push({
          id: `${startup.id}-${investor.id}-${Date.now()}`,
          startupId: startup.id,
          investorId: investor.id,
          startupName: startup.companyName,
          investorName: investor.firmName,
          timeSlot: '',
          slotTime: '',
          compatibilityScore: score.totalScore,
          status: 'upcoming',
          completed: false,
          score
        });
      }
    });
  });

  // Sort by compatibility score (highest first)
  allPossibleMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  // Track slot usage for each investor and startup
  const investorSlotUsage = new Map<string, number>();
  const startupMeetingCount = new Map<string, number>();
  
  // Initialize counts
  availableInvestors.forEach(investor => {
    investorSlotUsage.set(investor.id, 0);
  });
  
  availableStartups.forEach(startup => {
    startupMeetingCount.set(startup.id, 0);
  });

  // Account for preserved matches (completed and locked)
  preservedMatches.forEach(match => {
    const currentInvestorUsage = investorSlotUsage.get(match.investorId) || 0;
    const currentStartupCount = startupMeetingCount.get(match.startupId) || 0;
    
    investorSlotUsage.set(match.investorId, currentInvestorUsage + 1);
    startupMeetingCount.set(match.startupId, currentStartupCount + 1);
  });

  // Calculate target meetings per startup (evenly distributed)
  const totalAvailableSlots = availableInvestors.reduce((sum, inv) => {
    const usedSlots = investorSlotUsage.get(inv.id) || 0;
    return sum + Math.max(0, inv.totalSlots - usedSlots);
  }, 0);
  
  const targetMeetingsPerStartup = Math.floor(totalAvailableSlots / availableStartups.length);
  const extraMeetings = totalAvailableSlots % availableStartups.length;

  // Use custom time slots if provided, otherwise fall back to default
  const slotsToUse = timeSlots.length > 0 ? timeSlots.map(ts => ts.startTime + ' - ' + ts.endTime) : TIME_SLOTS;
  const slotLabels = timeSlots.length > 0 ? timeSlots.map(ts => ts.label) : TIME_SLOTS.map((_, i) => `Slot ${i + 1}`);

  // Compute per-slot capacity (number of available investors for that slot)
  const slotCapacity = slotLabels.map((_, i) => {
    const isSlotDone = timeSlots[i]?.isDone === true;
    if (isSlotDone) return 0;
    return availableInvestors.filter(inv => {
      const investorAvailable = !inv.slotAvailability || inv.slotAvailability[timeSlots[i]?.id] !== false;
      return investorAvailable;
    }).length;
  });

  // Create schedule grid for time slot assignment
  const scheduleGrid: { [timeSlot: string]: { startupIds: Set<string>, investorIds: Set<string> } } = {};
  slotsToUse.forEach((slot, index) => {
    scheduleGrid[slotLabels[index]] = { startupIds: new Set(), investorIds: new Set() };
  });

  // Add preserved matches to schedule grid (use label key)
  preservedMatches.forEach(match => {
    if (match.timeSlot && scheduleGrid[match.timeSlot]) {
      scheduleGrid[match.timeSlot].startupIds.add(match.startupId);
      scheduleGrid[match.timeSlot].investorIds.add(match.investorId);
    }
  });

  const newMatches: Match[] = [];

  // Pre-assign locked pairs (lock the pairing only, assign any valid slot)
  for (const lm of lockedMatches) {
    const startup = availableStartups.find(s => s.id === lm.startupId);
    const investor = availableInvestors.find(i => i.id === lm.investorId);
    if (!startup || !investor) continue;

    const currentInvestorUsage = investorSlotUsage.get(investor.id) || 0;
    if (currentInvestorUsage >= investor.totalSlots) continue;

    let assignedTimeSlot = '';
    let assignedSlotTime = '';
    for (let i = 0; i < slotLabels.length; i++) {
      const slotLabel = slotLabels[i];
      const gridCell = scheduleGrid[slotLabel];

      const isSlotDone = timeSlots[i]?.isDone === true;
      if (isSlotDone) continue;

      // Respect per-slot capacity
      if (gridCell.investorIds.size >= slotCapacity[i]) continue;

      const startupAvailable = !startup.slotAvailability || startup.slotAvailability[timeSlots[i]?.id] !== false;
      const investorAvailable = !investor.slotAvailability || investor.slotAvailability[timeSlots[i]?.id] !== false;

      if (
        !gridCell.startupIds.has(startup.id) &&
        !gridCell.investorIds.has(investor.id) &&
        startupAvailable &&
        investorAvailable
      ) {
        assignedTimeSlot = slotLabel;
        assignedSlotTime = slotsToUse[i];
        gridCell.startupIds.add(startup.id);
        gridCell.investorIds.add(investor.id);
        break;
      }
    }

    if (!assignedTimeSlot) continue;

    const score = calculateCompatibilityScore(startup, investor);
    const lockedMatch: Match = {
      id: lm.id,
      startupId: startup.id,
      investorId: investor.id,
      startupName: startup.companyName,
      investorName: investor.firmName,
      timeSlot: assignedTimeSlot,
      slotTime: assignedSlotTime,
      compatibilityScore: score.totalScore,
      status: 'upcoming',
      completed: false,
      locked: true,
      startupAttending: true,
      investorAttending: true
    };

    newMatches.push(lockedMatch);
    hasMet.add(`${startup.id}::${investor.id}`);

    investorSlotUsage.set(investor.id, (investorSlotUsage.get(investor.id) || 0) + 1);
    const currentStartupCount = startupMeetingCount.get(startup.id) || 0;
    startupMeetingCount.set(startup.id, currentStartupCount + 1);
  }

  // Fairness-first pass: ensure every startup reaches at least the average (floor)
  const minTargetPerStartup = targetMeetingsPerStartup; // floor average

  // Build candidate lists per startup (sorted by compatibility desc)
  const candidatesByStartup = new Map<string, (Match & { score: CompatibilityScore })[]>();
  for (const pm of allPossibleMatches) {
    const list = candidatesByStartup.get(pm.startupId) || [];
    list.push(pm);
    candidatesByStartup.set(pm.startupId, list);
  }
  for (const [sid, list] of candidatesByStartup) {
    list.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  // Round-robin assign one meeting per round to the startups with the fewest meetings
  for (let round = 1; round <= minTargetPerStartup; round++) {
    // Sort startups by current meeting count (ascending) to always prioritize those with fewer meetings
    const startupsByNeed = [...availableStartups].sort(
      (a, b) => (startupMeetingCount.get(a.id) || 0) - (startupMeetingCount.get(b.id) || 0)
    );

    for (const startup of startupsByNeed) {
      const currentCount = startupMeetingCount.get(startup.id) || 0;
      if (currentCount >= round) continue; // this startup already satisfied this round

      const candidates = candidatesByStartup.get(startup.id) || [];

      // Try candidates in score order
      for (const cand of candidates) {
        if (hasMet.has(`${cand.startupId}::${cand.investorId}`)) continue;
        const investor = availableInvestors.find(i => i.id === cand.investorId);
        if (!investor) continue;

        const currentInvestorUsage = investorSlotUsage.get(investor.id) || 0;
        if (currentInvestorUsage >= investor.totalSlots) continue; // investor full

        // Find an available time slot for both
        let assignedTimeSlot = '';
        let assignedSlotTime = '';
        for (let i = 0; i < slotLabels.length; i++) {
          const slotLabel = slotLabels[i];
          const gridCell = scheduleGrid[slotLabel];

          // Skip slots marked as done
          const isSlotDone = timeSlots[i]?.isDone === true;
          if (isSlotDone) continue;

          // Respect per-slot capacity
          if (gridCell.investorIds.size >= slotCapacity[i]) continue;

          const startupAvailable = !startup.slotAvailability || startup.slotAvailability[timeSlots[i]?.id] !== false;
          const investorAvailable = !investor.slotAvailability || investor.slotAvailability[timeSlots[i]?.id] !== false;

          if (
            !gridCell.startupIds.has(startup.id) &&
            !gridCell.investorIds.has(investor.id) &&
            startupAvailable &&
            investorAvailable
          ) {
            assignedTimeSlot = slotLabel;
            assignedSlotTime = slotsToUse[i];

            // Reserve this slot
            gridCell.startupIds.add(startup.id);
            gridCell.investorIds.add(investor.id);
            break;
          }
        }

        if (!assignedTimeSlot) {
          // Couldn't find a slot with this investor; try next candidate
          continue;
        }

        // Create the match
        const newMatch: Match = {
          id: `${startup.id}-${investor.id}-${Date.now()}-rr${round}`,
          startupId: startup.id,
          investorId: investor.id,
          startupName: startup.companyName,
          investorName: investor.firmName,
          timeSlot: assignedTimeSlot,
          slotTime: assignedSlotTime,
          compatibilityScore: cand.compatibilityScore,
          status: 'upcoming',
          completed: false,
          startupAttending: true,
          investorAttending: true
        };

        newMatches.push(newMatch);
        hasMet.add(`${startup.id}::${investor.id}`);

        investorSlotUsage.set(investor.id, currentInvestorUsage + 1);
        startupMeetingCount.set(startup.id, currentCount + 1);
        break; // assign only one meeting for this round for this startup
      }
    }
  }

  // Fill up to per-startup maximums using remaining high-score opportunities
  for (const potentialMatch of allPossibleMatches) {
    const investor = availableInvestors.find(i => i.id === potentialMatch.investorId)!;
    const startup = availableStartups.find(s => s.id === potentialMatch.startupId)!;

    if (hasMet.has(`${startup.id}::${investor.id}`)) continue;

    const currentInvestorUsage = investorSlotUsage.get(investor.id) || 0;
    const currentStartupCount = startupMeetingCount.get(startup.id) || 0;

    // Respect investor capacity
    if (currentInvestorUsage >= investor.totalSlots) continue;

    // Respect per-startup cap (balanced distribution: max = base + extras)
    const startupIndex = availableStartups.findIndex(s => s.id === startup.id);
    const maxMeetingsForThisStartup = targetMeetingsPerStartup + (startupIndex < extraMeetings ? 1 : 0);
    if (currentStartupCount >= maxMeetingsForThisStartup) continue;

    // Find available time slot where both are free and attending
    let assignedTimeSlot = '';
    let assignedSlotTime = '';
    for (let i = 0; i < slotLabels.length; i++) {
      const slotLabel = slotLabels[i];
      const slot = scheduleGrid[slotLabel];

      const isSlotDone = timeSlots[i]?.isDone === true;
      if (isSlotDone) continue;

      // Respect per-slot capacity
      if (slot.investorIds.size >= slotCapacity[i]) continue;

      const startupAvailable = !startup.slotAvailability || startup.slotAvailability[timeSlots[i]?.id] !== false;
      const investorAvailable = !investor.slotAvailability || investor.slotAvailability[timeSlots[i]?.id] !== false;

      if (
        !slot.startupIds.has(startup.id) &&
        !slot.investorIds.has(investor.id) &&
        startupAvailable &&
        investorAvailable
      ) {
        assignedTimeSlot = slotLabel;
        assignedSlotTime = slotsToUse[i];
        slot.startupIds.add(startup.id);
        slot.investorIds.add(investor.id);
        break;
      }
    }

    if (!assignedTimeSlot) continue;

    const newMatch: Match = {
      id: potentialMatch.id,
      startupId: startup.id,
      investorId: investor.id,
      startupName: startup.companyName,
      investorName: investor.firmName,
      timeSlot: assignedTimeSlot,
      slotTime: assignedSlotTime,
      compatibilityScore: potentialMatch.compatibilityScore,
      status: 'upcoming',
      completed: false,
      startupAttending: true,
      investorAttending: true
    };

    newMatches.push(newMatch);
    hasMet.add(`${startup.id}::${investor.id}`);
    investorSlotUsage.set(investor.id, currentInvestorUsage + 1);
    startupMeetingCount.set(startup.id, currentStartupCount + 1);
  }

  // Second pass: fill remaining open investor slots per time slot to maximize meetings
  for (let i = 0; i < slotLabels.length; i++) {
    const slotLabel = slotLabels[i];
    const slot = scheduleGrid[slotLabel];
    const isSlotDone = timeSlots[i]?.isDone === true;
    if (isSlotDone) continue;
    if (slot.investorIds.size >= slotCapacity[i]) continue;

    for (const investor of availableInvestors) {
      const currentInvestorUsage = investorSlotUsage.get(investor.id) || 0;
      if (currentInvestorUsage >= investor.totalSlots) continue;
      if (slot.investorIds.has(investor.id)) continue;

      const investorAvailable = !investor.slotAvailability || investor.slotAvailability[timeSlots[i]?.id] !== false;
      if (!investorAvailable) continue;

      const candidates = allPossibleMatches
        .filter(pm => pm.investorId === investor.id)
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      for (const cand of candidates) {
        const startup = availableStartups.find(s => s.id === cand.startupId)!;
        const startupAvailable = !startup.slotAvailability || startup.slotAvailability[timeSlots[i]?.id] !== false;

        if (!slot.startupIds.has(startup.id) && startupAvailable && !hasMet.has(`${startup.id}::${investor.id}`)) {
          const newMatch: Match = {
            id: `${startup.id}-${investor.id}-${Date.now()}-${i}`,
            startupId: startup.id,
            investorId: investor.id,
            startupName: startup.companyName,
            investorName: investor.firmName,
            timeSlot: slotLabel,
            slotTime: slotsToUse[i],
            compatibilityScore: cand.compatibilityScore,
            status: 'upcoming',
            completed: false,
            startupAttending: true,
            investorAttending: true
          };
          newMatches.push(newMatch);
          hasMet.add(`${startup.id}::${investor.id}`);

          investorSlotUsage.set(investor.id, (investorSlotUsage.get(investor.id) || 0) + 1);
          const currentStartupCount = startupMeetingCount.get(startup.id) || 0;
          startupMeetingCount.set(startup.id, currentStartupCount + 1);

          slot.investorIds.add(investor.id);
          slot.startupIds.add(startup.id);
          break;
        }
      }
    }
  }

  // Combine preserved matches with new matches and sort by time slot
  const allMatches = [...preservedMatches, ...newMatches];
  
  // Sort by time slot for better organization
  allMatches.sort((a, b) => {
    const timeA = slotsToUse.indexOf(a.slotTime);
    const timeB = slotsToUse.indexOf(b.slotTime);
    return timeA - timeB;
  });

  return allMatches;
}