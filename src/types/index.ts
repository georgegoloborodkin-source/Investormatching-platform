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

export interface Match {
  id: string;
  startupId: string;
  investorId: string;
  startupName: string;
  investorName: string;
  timeSlot: string;
  slotTime: string;
  compatibilityScore: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  completed: boolean;
  locked?: boolean;
  startupAttending?: boolean;
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