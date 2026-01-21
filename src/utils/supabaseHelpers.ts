import { supabase } from "@/integrations/supabase/client";
import type { CorporatePartner, DecisionLog, DocumentRecord, Event, Investor, Match, Mentor, Startup, TimeSlotConfig, UserProfile } from "@/types";

type SupabaseResult<T> = { data: T | null; error: any };

const DEFAULT_EVENT_NAME = "Main Event";

function slugifyOrgName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
}

export async function ensureOrganizationForUser(profile: UserProfile): Promise<SupabaseResult<{ organization: any; updatedProfile: UserProfile }>> {
  if (profile.organization_id) {
    const { data, error } = await supabase.from("organizations").select("*").eq("id", profile.organization_id).single();
    return { data: { organization: data, updatedProfile: profile }, error };
  }

  const fallbackName = profile.full_name || profile.email || "Default Organization";
  const orgPayload = {
    name: fallbackName,
    slug: slugifyOrgName(fallbackName) || `org-${profile.id.slice(0, 8)}`,
  };

  const { data: org, error: orgError } = await supabase.from("organizations").insert(orgPayload).select("*").single();
  if (orgError || !org) {
    return { data: null, error: orgError };
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from("user_profiles")
    .update({ organization_id: org.id })
    .eq("id", profile.id)
    .select("*")
    .single();

  return { data: { organization: org, updatedProfile: (updatedProfile as UserProfile) || profile }, error: profileError };
}

export async function ensureActiveEventForOrg(orgId: string): Promise<SupabaseResult<Event>> {
  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("date", { ascending: false });

  if (error) return { data: null, error };
  if (events && events.length > 0) return { data: events[0] as Event, error: null };

  const { data: created, error: createError } = await supabase
    .from("events")
    .insert({ organization_id: orgId, name: DEFAULT_EVENT_NAME, status: "active" })
    .select("*")
    .single();
  return { data: created as Event, error: createError };
}

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

export async function getMentorsByEvent(eventId: string) {
  return supabase.from("mentors").select("*").eq("event_id", eventId);
}

export async function getCorporatesByEvent(eventId: string) {
  return supabase.from("corporates").select("*").eq("event_id", eventId);
}

export async function getDecisionsByEvent(eventId: string) {
  return supabase
    .from("decisions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
}

export async function insertDecision(
  eventId: string,
  payload: {
    actor_id: string | null;
    actor_name: string;
    action_type: string;
    startup_name: string;
    context: Record<string, any> | null;
    confidence_score: number;
    outcome: string | null;
    notes: string | null;
    document_id?: string | null;
  }
) {
  return supabase.from("decisions").insert({ event_id: eventId, ...payload }).select("*").single();
}

export async function updateDecision(decisionId: string, updates: Partial<DecisionLog>) {
  return supabase.from("decisions").update(updates).eq("id", decisionId);
}

export async function deleteDecision(decisionId: string) {
  return supabase.from("decisions").delete().eq("id", decisionId);
}

export async function insertDocument(
  eventId: string,
  payload: {
    title: string | null;
    source_type: string;
    file_name: string | null;
    storage_path: string | null;
    detected_type: string | null;
    extracted_json: Record<string, any>;
    created_by: string | null;
  }
) {
  return supabase
    .from("documents")
    .insert({ event_id: eventId, ...payload })
    .select("*")
    .single();
}

export async function getDocumentsByEvent(eventId: string) {
  return supabase
    .from("documents")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
}

export async function upsertInvestors(eventId: string, investors: Investor[]) {
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
  }));
  return supabase.from("investors").upsert(payload, { onConflict: "id" });
}

export async function upsertStartups(eventId: string, startups: Startup[]) {
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
    investor_id: m.targetType === "investor" ? m.targetId : m.investorId || null,
    target_id: m.targetId,
    target_type: m.targetType,
    startup_name: m.startupName,
    target_name: m.targetName,
    time_slot_id: m.timeSlot || null,
    compatibility_score: m.compatibilityScore,
    score_breakdown: m.scoreBreakdown || [],
    status: m.status,
    completed: m.completed,
    locked: m.locked ?? false,
    startup_attending: m.startupAttending ?? null,
    target_attending: m.targetAttending ?? null,
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

export async function upsertMentors(eventId: string, mentors: Mentor[]) {
  const payload = mentors.map((m) => ({
    id: m.id,
    event_id: eventId,
    full_name: m.fullName,
    email: m.email,
    linkedin_url: m.linkedinUrl || null,
    geo_focus: m.geoFocus,
    industry_preferences: m.industryPreferences,
    expertise_areas: m.expertiseAreas,
    total_slots: m.totalSlots,
    availability_status: m.availabilityStatus,
    slot_availability: m.slotAvailability || {},
  }));
  return supabase.from("mentors").upsert(payload, { onConflict: "id" });
}

export async function upsertCorporates(eventId: string, corporates: CorporatePartner[]) {
  const payload = corporates.map((c) => ({
    id: c.id,
    event_id: eventId,
    firm_name: c.firmName,
    contact_name: c.contactName,
    email: c.email || null,
    geo_focus: c.geoFocus,
    industry_preferences: c.industryPreferences,
    partnership_types: c.partnershipTypes,
    stages: c.stages,
    total_slots: c.totalSlots,
    availability_status: c.availabilityStatus,
    slot_availability: c.slotAvailability || {},
  }));
  return supabase.from("corporates").upsert(payload, { onConflict: "id" });
}

export function mapInvestorRow(row: any): Investor {
  return {
    id: row.id,
    firmName: row.firm_name,
    memberName: row.member_name,
    geoFocus: row.geo_focus || [],
    industryPreferences: row.industry_preferences || [],
    stagePreferences: row.stage_preferences || [],
    minTicketSize: row.min_ticket_size || 0,
    maxTicketSize: row.max_ticket_size || 0,
    totalSlots: row.total_slots || 0,
    tableNumber: row.table_number || undefined,
    availabilityStatus: row.availability_status || "present",
    slotAvailability: row.slot_availability || {},
  };
}

export function mapStartupRow(row: any): Startup {
  return {
    id: row.id,
    companyName: row.company_name,
    geoMarkets: row.geo_markets || [],
    industry: row.industry || "",
    fundingTarget: row.funding_target || 0,
    fundingStage: row.funding_stage || "",
    availabilityStatus: row.availability_status || "present",
    slotAvailability: row.slot_availability || {},
  };
}

export function mapMentorRow(row: any): Mentor {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    linkedinUrl: row.linkedin_url || undefined,
    geoFocus: row.geo_focus || [],
    industryPreferences: row.industry_preferences || [],
    expertiseAreas: row.expertise_areas || [],
    totalSlots: row.total_slots || 0,
    availabilityStatus: row.availability_status || "present",
    slotAvailability: row.slot_availability || {},
  };
}

export function mapCorporateRow(row: any): CorporatePartner {
  return {
    id: row.id,
    firmName: row.firm_name,
    contactName: row.contact_name,
    email: row.email || undefined,
    geoFocus: row.geo_focus || [],
    industryPreferences: row.industry_preferences || [],
    partnershipTypes: row.partnership_types || [],
    stages: row.stages || [],
    totalSlots: row.total_slots || 0,
    availabilityStatus: row.availability_status || "present",
    slotAvailability: row.slot_availability || {},
  };
}

export function mapTimeSlotRow(row: any): TimeSlotConfig {
  return {
    id: row.id,
    label: row.label,
    startTime: row.start_time,
    endTime: row.end_time,
    isDone: row.is_done ?? false,
    breakAfter: row.break_after ?? undefined,
  };
}

export function mapMatchRow(row: any): Match {
  const targetId = row.target_id || row.investor_id;
  const targetType = row.target_type || "investor";
  return {
    id: row.id,
    startupId: row.startup_id,
    targetId,
    targetType,
    startupName: row.startup_name || "",
    targetName: row.target_name || "",
    timeSlot: row.time_slot_id || "",
    slotTime: "",
    compatibilityScore: row.compatibility_score || 0,
    scoreBreakdown: row.score_breakdown || [],
    status: row.status || "upcoming",
    completed: row.completed ?? false,
    locked: row.locked ?? false,
    startupAttending: row.startup_attending ?? undefined,
    targetAttending: row.target_attending ?? undefined,
    investorId: row.investor_id || undefined,
  };
}

