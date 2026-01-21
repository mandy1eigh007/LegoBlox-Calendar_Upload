export const CATEGORIES = ['PD', 'Shop', 'Math', 'Admin', 'Certification', 'Support Services', 'Other'] as const;
export type Category = typeof CATEGORIES[number];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Day = typeof DAYS[number];

export type AnchorPromptId =
  | 'math'
  | 'mock_interviews'
  | 'speed_mentoring'
  | 'guest_speakers'
  | 'apprenticeship_tours'
  | 'job_site_tours';

export interface AnchorEventDraft {
  id: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  durationMinutes: number;
  title: string;
  countsTowardGoldenRule: boolean;
  isLocked: boolean;
  created?: boolean;
}

export const COLOR_PALETTE = [
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Orange', hex: '#F97316' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Gray', hex: '#6B7280' },
] as const;

export const GOLDEN_RULE_BUCKETS = [
  { id: 'INTRO_PREAPP', label: 'Introduction to Pre-Apprenticeship', budgetMinutes: 180 },
  { id: 'PD_PRINCIPLES', label: 'Professional Development Principles (Intro+Mid+Final)', budgetMinutes: 180 },
  { id: 'GRIT_GROWTH', label: 'Grit/Growth Mindset', budgetMinutes: 60 },
  { id: 'SUCCESSFUL_APPRENTICE', label: 'How to be a Successful Apprentice', budgetMinutes: 60 },
  { id: 'ELEVATOR_PITCH', label: 'Elevator Pitch', budgetMinutes: 120 },
  { id: 'RESUMES', label: 'Resumes', budgetMinutes: 240 },
  { id: 'INTERVIEWS', label: 'Interviews (Interview Skills + Group Interviews + Mock Prep)', budgetMinutes: 600 },
  { id: 'APPLY_APPRENTICESHIPS', label: 'Applying for Apprenticeships & Job Search', budgetMinutes: 180 },
  { id: 'FINANCIAL_ED', label: 'Financial Education', budgetMinutes: 180 },
  { id: 'EMOTIONAL_INTEL', label: 'Emotional Intelligence', budgetMinutes: 120 },
  { id: 'RISE_UP', label: 'RISE Up Advocacy & Bystander Intervention', budgetMinutes: 120 },
  { id: 'WORKERS_COMP', label: 'Workers Compensation/Unemployment Insurance', budgetMinutes: 120 },
  { id: 'PORTFOLIO', label: 'Apprenticeship Portfolio', budgetMinutes: 240 },
  { id: 'CAREER_PLAN', label: 'Individual Career Plan', budgetMinutes: 180 },
  { id: 'APP_PREP', label: 'Application Prep', budgetMinutes: 120 },
  { id: 'MATH', label: 'Math', budgetMinutes: 0, isFlexible: true },
  { id: 'ACE_INSTRUCTION', label: 'ACE Instruction', budgetMinutes: 240 },
  { id: 'ACES', label: 'ACEs', budgetMinutes: 2160 },
  { id: 'SHOP_INTRO', label: 'Shop Introduction', budgetMinutes: 60 },
  { id: 'CONSTRUCTION_TRADES', label: 'Introduction to the Construction Trades', budgetMinutes: 120 },
  { id: 'TRADE_AWARENESS', label: 'Construction Trade Awareness + Poster Project', budgetMinutes: 240 },
  { id: 'LABOR_HISTORY', label: 'Labor History', budgetMinutes: 60 },
  { id: 'HAND_TOOLS', label: 'Hand Tools', budgetMinutes: 180 },
  { id: 'POWER_TOOLS', label: 'Power Tools', budgetMinutes: 180 },
  { id: 'MATERIALS', label: 'Materials Knowledge', budgetMinutes: 60 },
  { id: 'MEASURING_TAPE', label: 'Intro to Measuring Tape + Measuring Tape Exercises', budgetMinutes: 120 },
  { id: 'SKILLS_PROJECT', label: 'Skills Project', budgetMinutes: 2520 },
  { id: 'SCAFFOLDING', label: 'Intro to Scaffolding', budgetMinutes: 120 },
  { id: 'LADDER_SAFETY', label: 'Ladder Safety', budgetMinutes: 60 },
  { id: 'CLEAN_ENERGY', label: 'Intro to Clean Energy', budgetMinutes: 120 },
  { id: 'APPRENTICE_TOURS', label: 'Apprenticeship Tours', budgetMinutes: 1200 },
  { id: 'WORKSITE_TOURS', label: 'Worksite Tours', budgetMinutes: 480 },
  { id: 'SPEAKER_PRESENTATIONS', label: 'Speaker Presentations', budgetMinutes: 240 },
  { id: 'OSHA_10', label: 'OSHA 10', budgetMinutes: 600 },
  { id: 'FORKLIFT', label: 'Forklift Certification', budgetMinutes: 480 },
  { id: 'FLAGGER', label: 'Flagger Certification', budgetMinutes: 480 },
  { id: 'PHYSICAL_FITNESS', label: 'Physical Fitness', budgetMinutes: 1920 },
  { id: 'NUTRITION', label: 'Nutrition', budgetMinutes: 60 },
] as const;

export type GoldenRuleBucketId = typeof GOLDEN_RULE_BUCKETS[number]['id'];

export const DEFAULT_RESOURCES = ['Classroom 1', 'Classroom 2', 'Shop', 'Offsite', 'Administration'] as const;

export type RecurrenceType = 'none' | 'weekly' | 'custom';

export interface RecurrencePattern {
  type: RecurrenceType;
  daysOfWeek: Day[];
  startWeek: number;
  endWeek: number;
}

export type EngagementType = 'apprenticeship_tour' | 'worksite_tour' | 'speaker_presentation';

export const ENGAGEMENT_TYPES: { value: EngagementType; label: string; bucketId: GoldenRuleBucketId }[] = [
  { value: 'apprenticeship_tour', label: 'Apprenticeship Tour', bucketId: 'APPRENTICE_TOURS' },
  { value: 'worksite_tour', label: 'Worksite Tour', bucketId: 'WORKSITE_TOURS' },
  { value: 'speaker_presentation', label: 'Speaker Presentation', bucketId: 'SPEAKER_PRESENTATIONS' },
];

export interface PartnerOrg {
  id: string;
  name: string;
  address: string;
  notes: string;
}

export interface PartnerContact {
  id: string;
  orgId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface PartnerEngagement {
  id: string;
  orgId: string;
  contactIds: string[];
  type: EngagementType;
  title: string;
  address: string;
  ppeRequired: string;
  arrivalInstructions: string;
  parkingNotes: string;
  studentLimit: number | null;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

export interface BlockTemplate {
  id: string;
  title: string;
  category: Category;
  colorHex: string;
  defaultDurationMinutes: number;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | null;
  defaultLocation: string;
  defaultNotes: string;
  engagementId?: string | null;
  defaultResource?: string;
  matchKeywords?: string[];
  isArchived?: boolean;
}

export interface PlacedBlock {
  id: string;
  templateId: string | null;
  week: number;
  day: Day;
  startMinutes: number;
  durationMinutes: number;
  titleOverride: string;
  location: string;
  notes: string;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | null;
  recurrenceSeriesId: string | null;
  isRecurrenceException: boolean;
  engagementId?: string | null;
  resource?: string;
  category?: Category;
  partnerOrg?: string;
  partnerContact?: string;
  partnerEmail?: string;
  partnerPhone?: string;
  partnerAddress?: string;
  partnerPPE?: string;
  partnerParking?: string;
  isLocked?: boolean;
}

export interface RecurrenceSeries {
  id: string;
  templateId: string;
  pattern: RecurrencePattern;
  baseStartMinutes: number;
  baseDurationMinutes: number;
  baseLocation: string;
  baseNotes: string;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | null;
  isLocked?: boolean;
}

export type SchedulerMode = 'manual' | 'predictive';

export interface HardDate {
  id: string;
  week: number;
  day: Day;
  description: string;
}

export interface PlanSettings {
  name: string;
  weeks: number;
  startDate?: string;
  activeDays?: Day[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  slotMinutes: 15;
  resources: string[];
  allowOverlaps: boolean;
  showNotesOnPrint: boolean;
  schedulerMode: SchedulerMode;
  hardDates?: HardDate[];
  bucketAdjustments?: Partial<Record<GoldenRuleBucketId, number>>;
  anchorChecklist?: Partial<Record<AnchorPromptId, boolean>>;
  anchorSchedule?: Partial<Record<AnchorPromptId, AnchorEventDraft[]>>;
  anchorWizardDismissed?: boolean;
  partnerRequests?: PartnerRequestRef[];
}

export interface PartnerRequestRef {
  id: string;
  code: string;
  label: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  settings: PlanSettings;
  blocks: PlacedBlock[];
  recurrenceSeries: RecurrenceSeries[];
  isPublished?: boolean;
  publishedAt?: string | null;
  publicId?: string | null;
  updatedAt?: string;
}

export interface PartnersData {
  orgs: PartnerOrg[];
  contacts: PartnerContact[];
  engagements: PartnerEngagement[];
}

export interface AppState {
  version: 2;
  templates: BlockTemplate[];
  plans: Plan[];
  partners: PartnersData;
}

export type ApplyScope = 'this' | 'thisAndFuture' | 'all';

export type Action =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_TEMPLATE'; payload: BlockTemplate }
  | { type: 'UPDATE_TEMPLATE'; payload: BlockTemplate }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'DUPLICATE_TEMPLATE'; payload: string }
  | { type: 'RESET_TEMPLATES'; payload: BlockTemplate[] }
  | { type: 'ADD_PLAN'; payload: Plan }
  | { type: 'UPDATE_PLAN'; payload: Plan }
  | { type: 'DELETE_PLAN'; payload: string }
  | { type: 'ADD_BLOCK'; payload: { planId: string; block: PlacedBlock } }
  | { type: 'UPDATE_BLOCK'; payload: { planId: string; block: PlacedBlock; scope?: ApplyScope } }
  | { type: 'DELETE_BLOCK'; payload: { planId: string; blockId: string; scope?: ApplyScope } }
  | { type: 'ADD_RECURRENCE_SERIES'; payload: { planId: string; series: RecurrenceSeries } }
  | { type: 'UPDATE_RECURRENCE_SERIES'; payload: { planId: string; series: RecurrenceSeries } }
  | { type: 'DELETE_RECURRENCE_SERIES'; payload: { planId: string; seriesId: string } }
  | { type: 'COPY_WEEK'; payload: { planId: string; fromWeek: number; toWeek: number } }
  | { type: 'RESET_WEEK'; payload: { planId: string; week: number } }
  | { type: 'IMPORT_STATE'; payload: { state: AppState; mode: 'replace' | 'merge' } }
  | { type: 'ADD_PARTNER_ORG'; payload: PartnerOrg }
  | { type: 'UPDATE_PARTNER_ORG'; payload: PartnerOrg }
  | { type: 'DELETE_PARTNER_ORG'; payload: string }
  | { type: 'ADD_PARTNER_CONTACT'; payload: PartnerContact }
  | { type: 'UPDATE_PARTNER_CONTACT'; payload: PartnerContact }
  | { type: 'DELETE_PARTNER_CONTACT'; payload: string }
  | { type: 'ADD_PARTNER_ENGAGEMENT'; payload: PartnerEngagement }
  | { type: 'UPDATE_PARTNER_ENGAGEMENT'; payload: PartnerEngagement }
  | { type: 'DELETE_PARTNER_ENGAGEMENT'; payload: string }
  | { type: 'PUBLISH_PLAN'; payload: { planId: string; publicId: string; timestamp: string } }
  | { type: 'UNPUBLISH_PLAN'; payload: { planId: string; timestamp: string } }
  | { type: 'REGENERATE_PUBLIC_ID'; payload: { planId: string; newPublicId: string; timestamp: string } }
  | { type: 'ASSIGN_BLOCK_TEMPLATE'; payload: { planId: string; blockId: string; templateId: string | null; timestamp: string } }
  | { type: 'ASSIGN_MULTIPLE_BLOCKS_TEMPLATE'; payload: { planId: string; blockIds: string[]; templateId: string | null; timestamp: string } };

export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function formatMinutesAsHoursMinutes(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  if (hours === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}

export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
