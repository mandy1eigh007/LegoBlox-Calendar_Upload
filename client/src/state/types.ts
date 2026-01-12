export const ALLOWED_DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 480] as const;
export type AllowedDuration = typeof ALLOWED_DURATIONS[number];

export const CATEGORIES = ['PD', 'Shop', 'Math', 'Admin', 'Tour', 'Certification', 'Support Services', 'Other'] as const;
export type Category = typeof CATEGORIES[number];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type Day = typeof DAYS[number];

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

export const GOLDEN_RULE_TOPICS = [
  'Introduction to Pre-Apprenticeship',
  'Professional Development Principles (Intro/Mid/Final)',
  'Grit/Growth Mindset',
  'How to be a Successful Apprentice',
  'Elevator Pitch',
  'Resumes',
  'Interviews (Interview Skills + Group Interviews + Mock Prep)',
  'Applying for Apprenticeships & Job Search',
  'Financial Education',
  'Emotional Intelligence',
  'RISE Up Advocacy & Bystander Intervention',
  'Workers Compensation/Unemployment Insurance',
  'Apprenticeship Portfolio',
  'Individual Career Plan',
  'Application Prep',
  'ACE Instruction',
  'ACEs',
  'Shop Introduction',
  'Introduction to the Construction Trades',
  'Construction Trade Awareness + Poster Project',
  'Labor History',
  'Hand Tools',
  'Power Tools',
  'Materials Knowledge',
  'Intro to Measuring Tape + Measuring Tape Exercises',
  'Skills Projects (Crate/Anchor/Saw Horse/Wall)',
  'Intro to Scaffolding',
  'Ladder Safety',
  'Intro to Clean Energy',
  'Apprenticeship Tours',
  'Worksite Tours',
  'Speaker Presentations',
  'OSHA 10',
  'Forklift',
  'Flagger',
  'Physical Fitness',
  'Nutrition',
] as const;

export type GoldenRuleTopic = typeof GOLDEN_RULE_TOPICS[number];

export const GOLDEN_RULE_BUDGETS: Record<GoldenRuleTopic, number> = {
  'Introduction to Pre-Apprenticeship': 180,
  'Professional Development Principles (Intro/Mid/Final)': 180,
  'Grit/Growth Mindset': 60,
  'How to be a Successful Apprentice': 60,
  'Elevator Pitch': 120,
  'Resumes': 240,
  'Interviews (Interview Skills + Group Interviews + Mock Prep)': 600,
  'Applying for Apprenticeships & Job Search': 180,
  'Financial Education': 180,
  'Emotional Intelligence': 120,
  'RISE Up Advocacy & Bystander Intervention': 120,
  'Workers Compensation/Unemployment Insurance': 120,
  'Apprenticeship Portfolio': 240,
  'Individual Career Plan': 180,
  'Application Prep': 120,
  'ACE Instruction': 240,
  'ACEs': 2160,
  'Shop Introduction': 60,
  'Introduction to the Construction Trades': 120,
  'Construction Trade Awareness + Poster Project': 240,
  'Labor History': 60,
  'Hand Tools': 180,
  'Power Tools': 180,
  'Materials Knowledge': 60,
  'Intro to Measuring Tape + Measuring Tape Exercises': 120,
  'Skills Projects (Crate/Anchor/Saw Horse/Wall)': 2520,
  'Intro to Scaffolding': 120,
  'Ladder Safety': 60,
  'Intro to Clean Energy': 120,
  'Apprenticeship Tours': 1200,
  'Worksite Tours': 480,
  'Speaker Presentations': 240,
  'OSHA 10': 600,
  'Forklift': 480,
  'Flagger': 480,
  'Physical Fitness': 1920,
  'Nutrition': 60,
};

export interface BlockTemplate {
  id: string;
  title: string;
  category: Category;
  defaultDurationMin: AllowedDuration;
  colorHex: string;
  goldenRuleTopic: GoldenRuleTopic;
  defaultLocation?: string;
  defaultNotes?: string;
}

export interface PlacedBlock {
  id: string;
  templateId: string;
  week: number;
  day: Day;
  startTime: string;
  durationMin: AllowedDuration;
  titleOverride?: string;
  location?: string;
  notes?: string;
}

export interface PlanSettings {
  name: string;
  weeks: number;
  enabledDays: Day[];
  dayStartTime: string;
  dayEndTime: string;
  slotMin: 15;
  lunchEnabled: boolean;
  lunchStartTime: string;
  lunchDurationMin: number;
}

export interface Plan {
  id: string;
  settings: PlanSettings;
  blocks: PlacedBlock[];
}

export interface AppState {
  version: 1;
  templates: BlockTemplate[];
  plans: Plan[];
}

export type Action =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_TEMPLATE'; payload: BlockTemplate }
  | { type: 'UPDATE_TEMPLATE'; payload: BlockTemplate }
  | { type: 'DELETE_TEMPLATE'; payload: string }
  | { type: 'ADD_PLAN'; payload: Plan }
  | { type: 'UPDATE_PLAN'; payload: Plan }
  | { type: 'DELETE_PLAN'; payload: string }
  | { type: 'ADD_BLOCK'; payload: { planId: string; block: PlacedBlock } }
  | { type: 'UPDATE_BLOCK'; payload: { planId: string; block: PlacedBlock } }
  | { type: 'DELETE_BLOCK'; payload: { planId: string; blockId: string } }
  | { type: 'COPY_WEEK'; payload: { planId: string; fromWeek: number; toWeek: number } }
  | { type: 'RESET_WEEK'; payload: { planId: string; week: number } }
  | { type: 'IMPORT_STATE'; payload: { state: AppState; mode: 'replace' | 'merge' } };
