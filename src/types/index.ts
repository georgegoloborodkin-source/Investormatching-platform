export interface Startup {
  id: string;
  companyName: string;
  geoMarkets: string[];
  industry: string;
  fundingTarget: number;
  fundingStage: string;
  availabilityStatus: 'present' | 'not-attending';
  slotAvailability?: Record<string, boolean>; // Track availability per time slot
}

export interface Investor {
  id: string;
  firmName: string;
  memberName: string; // REQUIRED person/VC team member name
  geoFocus: string[];
  industryPreferences: string[];
  stagePreferences: string[];
  minTicketSize: number;
  maxTicketSize: number;
  totalSlots: number;
  tableNumber?: string;
  availabilityStatus: 'present' | 'not-attending';
  slotAvailability?: Record<string, boolean>; // Track availability per time slot
}

export interface Mentor {
  id: string;
  fullName: string;
  email: string;
  linkedinUrl?: string;
  geoFocus: string[];
  industryPreferences: string[];
  expertiseAreas: string[];
  totalSlots: number;
  availabilityStatus: 'present' | 'not-attending';
  slotAvailability?: Record<string, boolean>;
}

export interface CorporatePartner {
  id: string;
  firmName: string;
  contactName: string;
  email?: string;
  geoFocus: string[];
  industryPreferences: string[];
  partnershipTypes: string[]; // e.g., "Pilot", "Distribution", "Investment"
  stages: string[];
  totalSlots: number;
  availabilityStatus: 'present' | 'not-attending';
  slotAvailability?: Record<string, boolean>;
}

export interface Match {
  id: string;
  startupId: string;
  targetId: string; // investorId, mentorId, or corporateId
  targetType: 'investor' | 'mentor' | 'corporate';
  startupName: string;
  targetName: string; // investor/mentor/corporate name
  timeSlot: string;
  slotTime: string;
  compatibilityScore: number;
  scoreBreakdown?: string[]; // MVP: human-readable scoring explanation lines
  status: 'upcoming' | 'completed' | 'cancelled';
  completed: boolean;
  locked?: boolean;
  startupAttending?: boolean;
  targetAttending?: boolean;
  // Legacy fields for backward compatibility
  investorId?: string;
  investorName?: string;
  investorAttending?: boolean;
}

export interface TimeSlotConfig {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  isDone?: boolean; // when true, no new matches will be scheduled in this slot
  breakAfter?: number; // break duration in minutes after this slot
}

export const GEO_MARKETS = [
  'North America',
  'Europe',
  'UAE',
  'Saudi Arabia',
  'Egypt',
  'Jordan',
  'Asia-Pacific',
  'Latin America',
  'Africa'
];

export const INDUSTRIES = [
  'Fintech',
  'Healthtech',
  'EdTech',
  'E-commerce',
  'Construction',
  'Transportation/Mobility',
  'AI/ML',
  'Logistics',
  'Consumer Goods',
  'SaaS',
  'CleanTech'
];

export const FUNDING_STAGES = [
  'Pre-seed',
  'Seed',
  'Series A',
  'Series B+'
];

export const PARTNERSHIP_TYPES = [
  'Pilot Program',
  'Distribution',
  'Strategic Investment',
  'Co-Development',
  'Technology Integration',
  'Market Access'
];

export const EXPERTISE_AREAS = [
  'Product Development',
  'Go-to-Market Strategy',
  'Fundraising',
  'Operations',
  'Technology Architecture',
  'Team Building',
  'Marketing & Sales',
  'Legal & Compliance'
];

// User & Organization Types
// Simplified 2-role system: organizer (admin) and investor (participant)
export type UserRole = 'organizer' | 'investor';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  organization_id: string;
  name: string;
  date: string | null;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface DecisionLog {
  id: string;
  event_id: string;
  actor_id: string | null;
  actor_name: string;
  action_type: string;
  startup_name: string;
  context: Record<string, any> | null;
  confidence_score: number;
  outcome: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}