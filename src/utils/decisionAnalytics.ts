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

export interface DecisionEngineAnalytics {
  sectorStats: SectorStats[];
  stageStats: StageStats[];
  partnerStats: PartnerStats[];
  decisionVelocity: DecisionVelocity[];
  timeSeries: TimeSeriesData[];
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
      decisionVelocity: [],
      timeSeries: [],
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

  return {
    sectorStats,
    stageStats,
    partnerStats,
    decisionVelocity,
    timeSeries,
    totalDecisions,
    avgConfidence,
    positiveRate,
    avgDecisionVelocity,
  };
}
