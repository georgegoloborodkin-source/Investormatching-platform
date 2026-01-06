import { supabase } from "@/integrations/supabase/client";
import type { Investor, Match, Startup } from "@/types";

export async function getActiveEvents(organizationId: string) {
  return supabase
    .from("events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("date", { ascending: false });
}

export async function getEvent(eventId: string) {
  return supabase.from("events").select("*").eq("id", eventId).single();
}

export async function getInvestorsByEvent(eventId: string) {
  return supabase.from("investors").select("*").eq("event_id", eventId);
}

export async function getStartupsByEvent(eventId: string) {
  return supabase.from("startups").select("*").eq("event_id", eventId);
}

export async function getTimeSlotsByEvent(eventId: string) {
  return supabase.from("time_slots").select("*").eq("event_id", eventId).order("start_time", { ascending: true });
}

export async function getMatchesByEvent(eventId: string) {
  return supabase.from("matches").select("*").eq("event_id", eventId);
}

export async function upsertInvestors(eventId: string, investors: Investor[], organizationId?: string) {
  // Map frontend Investor to DB shape
  const payload = investors.map((inv) => ({
    id: inv.id,
    event_id: eventId,
    firm_name: inv.firmName,
    member_name: inv.memberName,
    geo_focus: inv.geoFocus,
    industry_preferences: inv.industryPreferences,
    stage_preferences: inv.stagePreferences,
    min_ticket_size: inv.minTicketSize,
    max_ticket_size: inv.maxTicketSize,
    total_slots: inv.totalSlots,
    table_number: inv.tableNumber || null,
    availability_status: inv.availabilityStatus,
    slot_availability: inv.slotAvailability || {},
    organization_id: organizationId,
  }));
  return supabase.from("investors").upsert(payload, { onConflict: "id" });
}

export async function upsertStartups(eventId: string, startups: Startup[], organizationId?: string) {
  const payload = startups.map((s) => ({
    id: s.id,
    event_id: eventId,
    company_name: s.companyName,
    geo_markets: s.geoMarkets,
    industry: s.industry,
    funding_target: s.fundingTarget,
    funding_stage: s.fundingStage,
    availability_status: s.availabilityStatus,
    slot_availability: s.slotAvailability || {},
    organization_id: organizationId,
  }));
  return supabase.from("startups").upsert(payload, { onConflict: "id" });
}

export async function upsertTimeSlots(eventId: string, timeSlots: any[]) {
  const payload = timeSlots.map((t) => ({
    id: t.id,
    event_id: eventId,
    label: t.label,
    start_time: t.startTime || t.start_time,
    end_time: t.endTime || t.end_time,
    is_done: t.isDone ?? t.is_done ?? false,
    break_after: t.breakAfter ?? t.break_after ?? null,
  }));
  return supabase.from("time_slots").upsert(payload, { onConflict: "id" });
}

export async function upsertMatches(eventId: string, matches: Match[]) {
  const payload = matches.map((m) => ({
    id: m.id,
    event_id: eventId,
    startup_id: m.startupId,
    investor_id: m.investorId,
    time_slot_id: m.timeSlot,
    compatibility_score: m.compatibilityScore,
    score_breakdown: m.scoreBreakdown || [],
    status: m.status,
    completed: m.completed,
    locked: m.locked ?? false,
  }));
  return supabase.from("matches").upsert(payload, { onConflict: "id" });
}

export async function saveInvestorAvailability(investorId: string, eventId: string, slotAvailability: Record<string, boolean>) {
  return supabase
    .from("investors")
    .update({ slot_availability: slotAvailability })
    .eq("id", investorId)
    .eq("event_id", eventId);
}

