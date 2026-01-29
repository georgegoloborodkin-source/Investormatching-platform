import type { Decision } from "./claudeConverter";

export interface SectorStats {
  sector: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  conversionRate: number;
  avgConfidence: number;
}

export interface StageStats {
  stage: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  conversionRate: number;
  avgConfidence: number;
}

export interface PartnerStats {
  partner: string;
  totalDecisions: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  pendingOutcomes: number;
  winRate: number;
  avgConfidence: number;
  avgDecisionVelocity: number; // days from first meeting to decision
}

export interface OutcomeStats {
  outcome: string;
  total: number;
  avgConfidence: number;
}

export interface ActionTypeStats {
  action: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  avgConfidence: number;
}

export interface StartupStats {
  startupName: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  avgConfidence: number;
}

export interface DecisionVelocity {
  date: string;
  avgDays: number;
  count: number;
}

export interface TimeSeriesData {
  date: string;
  decisions: number;
  positive: number;
  negative: number;
  pending: number;
}

export interface CumulativeSeriesData {
  date: string;
  cumulativeDecisions: number;
}

export interface ConfidenceBucket {
  range: string;
  count: number;
  positive: number;
  negative: number;
  pending: number;
  avgConfidence: number;
}

export interface AgeBucket {
  range: string;
  count: number;
  positive: number;
  negative: number;
  pending: number;
}

export interface OutcomeByStage {
  stage: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  positiveRate: number;
}

export interface GeoStats {
  geo: string;
  total: number;
  positive: number;
  negative: number;
  pending: number;
  avgConfidence: number;
}

export interface RecencyStats {
  last7: number;
  last30: number;
  last90: number;
  prev30: number;
  momentumPct: number;
}

export interface DecisionEngineAnalytics {
  sectorStats: SectorStats[];
  stageStats: StageStats[];
  partnerStats: PartnerStats[];
  outcomeStats: OutcomeStats[];
  actionTypeStats: ActionTypeStats[];
  startupStats: StartupStats[];
  decisionVelocity: DecisionVelocity[];
  timeSeries: TimeSeriesData[];
  cumulativeSeries: CumulativeSeriesData[];
  confidenceBuckets: ConfidenceBucket[];
  ageBuckets: AgeBucket[];
  outcomeByStage: OutcomeByStage[];
  geoStats: GeoStats[];
  recencyStats: RecencyStats;
  outcomeRateSeries: Array<{ date: string; positiveRate: number; total: number }>;
  totalDecisions: number;
  avgConfidence: number;
  positiveRate: number;
  avgDecisionVelocity: number;
}

/**
 * Calculate comprehensive Decision Engine analytics
 */
export function calculateDecisionEngineAnalytics(decisions: Decision[]): DecisionEngineAnalytics {
  if (decisions.length === 0) {
    return {
      sectorStats: [],
      stageStats: [],
      partnerStats: [],
      outcomeStats: [],
      actionTypeStats: [],
      startupStats: [],
      decisionVelocity: [],
      timeSeries: [],
      cumulativeSeries: [],
      confidenceBuckets: [],
      ageBuckets: [],
      outcomeByStage: [],
      geoStats: [],
      recencyStats: {
        last7: 0,
        last30: 0,
        last90: 0,
        prev30: 0,
        momentumPct: 0,
      },
      outcomeRateSeries: [],
      totalDecisions: 0,
      avgConfidence: 0,
      positiveRate: 0,
      avgDecisionVelocity: 0,
    };
  }

  // Sector stats
  const sectorMap = new Map<string, { total: number; positive: number; negative: number; pending: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const sector = d.context?.sector || "Unknown";
    const stats = sectorMap.get(sector) || { total: 0, positive: 0, negative: 0, pending: 0, confidenceSum: 0 };
    stats.total++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    stats.confidenceSum += d.confidenceScore;
    sectorMap.set(sector, stats);
  });

  const sectorStats: SectorStats[] = Array.from(sectorMap.entries()).map(([sector, stats]) => ({
    sector,
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    pending: stats.pending,
    conversionRate: stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
    avgConfidence: Math.round(stats.confidenceSum / stats.total),
  })).sort((a, b) => b.total - a.total);

  // Stage stats
  const stageMap = new Map<string, { total: number; positive: number; negative: number; pending: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const stage = d.context?.stage || "Unknown";
    const stats = stageMap.get(stage) || { total: 0, positive: 0, negative: 0, pending: 0, confidenceSum: 0 };
    stats.total++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    stats.confidenceSum += d.confidenceScore;
    stageMap.set(stage, stats);
  });

  const stageStats: StageStats[] = Array.from(stageMap.entries()).map(([stage, stats]) => ({
    stage,
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    pending: stats.pending,
    conversionRate: stats.total > 0 ? Math.round((stats.positive / stats.total) * 100) : 0,
    avgConfidence: Math.round(stats.confidenceSum / stats.total),
  })).sort((a, b) => b.total - a.total);

  // Partner stats
  const partnerMap = new Map<string, { decisions: Decision[]; positive: number; negative: number; pending: number }>();
  decisions.forEach((d) => {
    const partner = d.actor || "Unknown";
    const stats = partnerMap.get(partner) || { decisions: [], positive: 0, negative: 0, pending: 0 };
    stats.decisions.push(d);
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    partnerMap.set(partner, stats);
  });

  const partnerStats: PartnerStats[] = Array.from(partnerMap.entries()).map(([partner, stats]) => {
    const totalDecisions = stats.decisions.length;
    const positiveOutcomes = stats.positive;
    const avgConfidence = Math.round(
      stats.decisions.reduce((sum, d) => sum + d.confidenceScore, 0) / totalDecisions
    );
    
    // Calculate decision velocity (simplified: days since decision was made)
    // In production, you'd track actual meeting → decision time
    const decisionDates = stats.decisions.map((d) => new Date(d.timestamp).getTime());
    const avgDecisionVelocity = decisionDates.length > 1
      ? Math.round((Math.max(...decisionDates) - Math.min(...decisionDates)) / (1000 * 60 * 60 * 24) / totalDecisions)
      : 0;

    return {
      partner,
      totalDecisions,
      positiveOutcomes,
      negativeOutcomes: stats.negative,
      pendingOutcomes: stats.pending,
      winRate: totalDecisions > 0 ? Math.round((positiveOutcomes / totalDecisions) * 100) : 0,
      avgConfidence,
      avgDecisionVelocity,
    };
  }).sort((a, b) => b.totalDecisions - a.totalDecisions);

  // Outcome stats
  const outcomeMap = new Map<string, { total: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const outcome = d.outcome || "pending";
    const stats = outcomeMap.get(outcome) || { total: 0, confidenceSum: 0 };
    stats.total++;
    stats.confidenceSum += d.confidenceScore;
    outcomeMap.set(outcome, stats);
  });
  const outcomeStats: OutcomeStats[] = Array.from(outcomeMap.entries()).map(([outcome, stats]) => ({
    outcome,
    total: stats.total,
    avgConfidence: stats.total > 0 ? Math.round(stats.confidenceSum / stats.total) : 0,
  }));

  // Action type stats
  const actionMap = new Map<string, { total: number; positive: number; negative: number; pending: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const action = d.actionType || "Unknown";
    const stats = actionMap.get(action) || { total: 0, positive: 0, negative: 0, pending: 0, confidenceSum: 0 };
    stats.total++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    stats.confidenceSum += d.confidenceScore;
    actionMap.set(action, stats);
  });
  const actionTypeStats: ActionTypeStats[] = Array.from(actionMap.entries()).map(([action, stats]) => ({
    action,
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    pending: stats.pending,
    avgConfidence: stats.total > 0 ? Math.round(stats.confidenceSum / stats.total) : 0,
  })).sort((a, b) => b.total - a.total);

  // Startup stats
  const startupMap = new Map<string, { total: number; positive: number; negative: number; pending: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const name = d.startupName || "Unknown";
    const stats = startupMap.get(name) || { total: 0, positive: 0, negative: 0, pending: 0, confidenceSum: 0 };
    stats.total++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    stats.confidenceSum += d.confidenceScore;
    startupMap.set(name, stats);
  });
  const startupStats: StartupStats[] = Array.from(startupMap.entries()).map(([startupName, stats]) => ({
    startupName,
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    pending: stats.pending,
    avgConfidence: stats.total > 0 ? Math.round(stats.confidenceSum / stats.total) : 0,
  })).sort((a, b) => b.total - a.total);

  // Geo stats
  const geoMap = new Map<string, { total: number; positive: number; negative: number; pending: number; confidenceSum: number }>();
  decisions.forEach((d) => {
    const geo = d.context?.geo || "Unknown";
    const stats = geoMap.get(geo) || { total: 0, positive: 0, negative: 0, pending: 0, confidenceSum: 0 };
    stats.total++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    stats.confidenceSum += d.confidenceScore;
    geoMap.set(geo, stats);
  });
  const geoStats: GeoStats[] = Array.from(geoMap.entries()).map(([geo, stats]) => ({
    geo,
    total: stats.total,
    positive: stats.positive,
    negative: stats.negative,
    pending: stats.pending,
    avgConfidence: stats.total > 0 ? Math.round(stats.confidenceSum / stats.total) : 0,
  })).sort((a, b) => b.total - a.total);

  // Outcome by stage (stacked)
  const outcomeByStage: OutcomeByStage[] = stageStats.map((stage) => ({
    stage: stage.stage,
    total: stage.total,
    positive: stage.positive,
    negative: stage.negative,
    pending: stage.pending,
    positiveRate: stage.conversionRate,
  }));

  // Confidence buckets
  const buckets = [
    { label: "0-20", min: 0, max: 20 },
    { label: "21-40", min: 21, max: 40 },
    { label: "41-60", min: 41, max: 60 },
    { label: "61-80", min: 61, max: 80 },
    { label: "81-100", min: 81, max: 100 },
  ];
  const confidenceBuckets: ConfidenceBucket[] = buckets.map((bucket) => {
    const bucketDecisions = decisions.filter(
      (d) => d.confidenceScore >= bucket.min && d.confidenceScore <= bucket.max
    );
    const positive = bucketDecisions.filter((d) => d.outcome === "positive").length;
    const negative = bucketDecisions.filter((d) => d.outcome === "negative").length;
    const pending = bucketDecisions.length - positive - negative;
    const avgConfidence = bucketDecisions.length
      ? Math.round(bucketDecisions.reduce((sum, d) => sum + d.confidenceScore, 0) / bucketDecisions.length)
      : 0;
    return {
      range: bucket.label,
      count: bucketDecisions.length,
      positive,
      negative,
      pending,
      avgConfidence,
    };
  });

  // Decision age buckets (days since decision)
  const ageRanges = [
    { label: "0-7d", min: 0, max: 7 },
    { label: "8-30d", min: 8, max: 30 },
    { label: "31-90d", min: 31, max: 90 },
    { label: "91-180d", min: 91, max: 180 },
    { label: "181d+", min: 181, max: Number.MAX_SAFE_INTEGER },
  ];
  const ageBuckets: AgeBucket[] = ageRanges.map((bucket) => {
    const bucketDecisions = decisions.filter((d) => {
      const ageDays = Math.floor((Date.now() - new Date(d.timestamp).getTime()) / 86400000);
      return ageDays >= bucket.min && ageDays <= bucket.max;
    });
    const positive = bucketDecisions.filter((d) => d.outcome === "positive").length;
    const negative = bucketDecisions.filter((d) => d.outcome === "negative").length;
    const pending = bucketDecisions.length - positive - negative;
    return {
      range: bucket.label,
      count: bucketDecisions.length,
      positive,
      negative,
      pending,
    };
  });

  // Decision velocity over time (monthly buckets)
  const velocityMap = new Map<string, { days: number[]; count: number }>();
  decisions.forEach((d) => {
    const date = new Date(d.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const stats = velocityMap.get(monthKey) || { days: [], count: 0 };
    // Simplified: use days since epoch as proxy for velocity
    stats.days.push(Math.floor(date.getTime() / (1000 * 60 * 60 * 24)));
    stats.count++;
    velocityMap.set(monthKey, stats);
  });

  const decisionVelocity: DecisionVelocity[] = Array.from(velocityMap.entries())
    .map(([date, stats]) => ({
      date,
      avgDays: stats.days.length > 1
        ? Math.round((Math.max(...stats.days) - Math.min(...stats.days)) / stats.days.length)
        : 0,
      count: stats.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12); // Last 12 months

  // Time series (monthly)
  const timeSeriesMap = new Map<string, { decisions: number; positive: number; negative: number; pending: number }>();
  decisions.forEach((d) => {
    const date = new Date(d.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const stats = timeSeriesMap.get(monthKey) || { decisions: 0, positive: 0, negative: 0, pending: 0 };
    stats.decisions++;
    if (d.outcome === "positive") stats.positive++;
    else if (d.outcome === "negative") stats.negative++;
    else stats.pending++;
    timeSeriesMap.set(monthKey, stats);
  });

  const timeSeries: TimeSeriesData[] = Array.from(timeSeriesMap.entries())
    .map(([date, stats]) => ({
      date,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12); // Last 12 months

  const outcomeRateSeries = timeSeries.map((row) => ({
    date: row.date,
    positiveRate: row.decisions ? Math.round((row.positive / row.decisions) * 100) : 0,
    total: row.decisions,
  }));

  const cumulativeSeries: CumulativeSeriesData[] = [];
  let runningTotal = 0;
  timeSeries.forEach((row) => {
    runningTotal += row.decisions;
    cumulativeSeries.push({ date: row.date, cumulativeDecisions: runningTotal });
  });

  // Overall stats
  const totalDecisions = decisions.length;
  const avgConfidence = Math.round(
    decisions.reduce((sum, d) => sum + d.confidenceScore, 0) / totalDecisions
  );
  const positiveCount = decisions.filter((d) => d.outcome === "positive").length;
  const positiveRate = totalDecisions > 0 ? Math.round((positiveCount / totalDecisions) * 100) : 0;
  
  // Overall decision velocity (simplified)
  const decisionDates = decisions.map((d) => new Date(d.timestamp).getTime());
  const avgDecisionVelocity = decisionDates.length > 1
    ? Math.round((Math.max(...decisionDates) - Math.min(...decisionDates)) / (1000 * 60 * 60 * 24) / totalDecisions)
    : 0;

  // Recency stats
  const now = Date.now();
  const days = (ms: number) => Math.floor(ms / (1000 * 60 * 60 * 24));
  const last7 = decisions.filter((d) => now - new Date(d.timestamp).getTime() <= 7 * 86400000).length;
  const last30 = decisions.filter((d) => now - new Date(d.timestamp).getTime() <= 30 * 86400000).length;
  const last90 = decisions.filter((d) => now - new Date(d.timestamp).getTime() <= 90 * 86400000).length;
  const prev30 = decisions.filter((d) => {
    const ageDays = days(now - new Date(d.timestamp).getTime());
    return ageDays > 30 && ageDays <= 60;
  }).length;
  const momentumPct = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : (last30 > 0 ? 100 : 0);
  const recencyStats: RecencyStats = { last7, last30, last90, prev30, momentumPct };

  return {
    sectorStats,
    stageStats,
    partnerStats,
    outcomeStats,
    actionTypeStats,
    startupStats,
    decisionVelocity,
    timeSeries,
    cumulativeSeries,
    confidenceBuckets,
    ageBuckets,
    outcomeByStage,
    geoStats,
    recencyStats,
    outcomeRateSeries,
    totalDecisions,
    avgConfidence,
    positiveRate,
    avgDecisionVelocity,
  };
}
