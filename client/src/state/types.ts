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

export const GOLDEN_RULE_KEYS = [
  'INTRO_PREAPP',
  'PD_PRINCIPLES',
  'GRIT_GROWTH',
  'SUCCESSFUL_APPRENTICE',
  'ELEVATOR_PITCH',
  'RESUMES',
  'INTERVIEWS',
  'APPLY_APPRENTICESHIPS',
  'FINANCIAL_ED',
  'EMOTIONAL_INTEL',
  'RISE_UP',
  'WORKERS_COMP',
  'PORTFOLIO',
  'CAREER_PLAN',
  'APP_PREP',
  'ACE_INSTRUCTION',
  'ACES',
  'SHOP_INTRO',
  'CONSTRUCTION_TRADES',
  'TRADE_AWARENESS',
  'LABOR_HISTORY',
  'HAND_TOOLS',
  'POWER_TOOLS',
  'MATERIALS',
  'MEASURING_TAPE',
  'SKILLS_PROJECTS',
  'SCAFFOLDING',
  'LADDER_SAFETY',
  'CLEAN_ENERGY',
  'APPRENTICE_TOURS',
  'WORKSITE_TOURS',
  'SPEAKER_PRESENTATIONS',
  'OSHA_10',
  'FORKLIFT',
  'FLAGGER',
  'PHYSICAL_FITNESS',
  'NUTRITION',
] as const;

export type GoldenRuleKey = typeof GOLDEN_RULE_KEYS[number];

export interface GoldenRuleBudgetItem {
  key: GoldenRuleKey;
  label: string;
  budgetMinutes: number;
}

export const GOLDEN_RULE_BUDGETS: GoldenRuleBudgetItem[] = [
  { key: 'INTRO_PREAPP', label: 'Introduction to Pre-Apprenticeship', budgetMinutes: 180 },
  { key: 'PD_PRINCIPLES', label: 'Professional Development Principles (Intro/Mid/Final)', budgetMinutes: 180 },
  { key: 'GRIT_GROWTH', label: 'Grit/Growth Mindset', budgetMinutes: 60 },
  { key: 'SUCCESSFUL_APPRENTICE', label: 'How to be a Successful Apprentice', budgetMinutes: 60 },
  { key: 'ELEVATOR_PITCH', label: 'Elevator Pitch', budgetMinutes: 120 },
  { key: 'RESUMES', label: 'Resumes', budgetMinutes: 240 },
  { key: 'INTERVIEWS', label: 'Interviews (Interview Skills + Group Interviews + Mock Prep)', budgetMinutes: 600 },
  { key: 'APPLY_APPRENTICESHIPS', label: 'Applying for Apprenticeships & Job Search', budgetMinutes: 180 },
  { key: 'FINANCIAL_ED', label: 'Financial Education', budgetMinutes: 180 },
  { key: 'EMOTIONAL_INTEL', label: 'Emotional Intelligence', budgetMinutes: 120 },
  { key: 'RISE_UP', label: 'RISE Up Advocacy & Bystander Intervention', budgetMinutes: 120 },
  { key: 'WORKERS_COMP', label: 'Workers Compensation/Unemployment Insurance', budgetMinutes: 120 },
  { key: 'PORTFOLIO', label: 'Apprenticeship Portfolio', budgetMinutes: 240 },
  { key: 'CAREER_PLAN', label: 'Individual Career Plan', budgetMinutes: 180 },
  { key: 'APP_PREP', label: 'Application Prep', budgetMinutes: 120 },
  { key: 'ACE_INSTRUCTION', label: 'ACE Instruction', budgetMinutes: 240 },
  { key: 'ACES', label: 'ACEs', budgetMinutes: 2160 },
  { key: 'SHOP_INTRO', label: 'Shop Introduction', budgetMinutes: 60 },
  { key: 'CONSTRUCTION_TRADES', label: 'Introduction to the Construction Trades', budgetMinutes: 120 },
  { key: 'TRADE_AWARENESS', label: 'Construction Trade Awareness + Poster Project', budgetMinutes: 240 },
  { key: 'LABOR_HISTORY', label: 'Labor History', budgetMinutes: 60 },
  { key: 'HAND_TOOLS', label: 'Hand Tools', budgetMinutes: 180 },
  { key: 'POWER_TOOLS', label: 'Power Tools', budgetMinutes: 180 },
  { key: 'MATERIALS', label: 'Materials Knowledge', budgetMinutes: 60 },
  { key: 'MEASURING_TAPE', label: 'Intro to Measuring Tape + Measuring Tape Exercises', budgetMinutes: 120 },
  { key: 'SKILLS_PROJECTS', label: 'Skills Projects (Crate/Anchor/Saw Horse/Wall)', budgetMinutes: 2520 },
  { key: 'SCAFFOLDING', label: 'Intro to Scaffolding', budgetMinutes: 120 },
  { key: 'LADDER_SAFETY', label: 'Ladder Safety', budgetMinutes: 60 },
  { key: 'CLEAN_ENERGY', label: 'Intro to Clean Energy', budgetMinutes: 120 },
  { key: 'APPRENTICE_TOURS', label: 'Apprenticeship Tours', budgetMinutes: 1200 },
  { key: 'WORKSITE_TOURS', label: 'Worksite Tours', budgetMinutes: 480 },
  { key: 'SPEAKER_PRESENTATIONS', label: 'Speaker Presentations', budgetMinutes: 240 },
  { key: 'OSHA_10', label: 'OSHA 10', budgetMinutes: 600 },
  { key: 'FORKLIFT', label: 'Forklift', budgetMinutes: 480 },
  { key: 'FLAGGER', label: 'Flagger', budgetMinutes: 480 },
  { key: 'PHYSICAL_FITNESS', label: 'Physical Fitness', budgetMinutes: 1920 },
  { key: 'NUTRITION', label: 'Nutrition', budgetMinutes: 60 },
];

export interface BlockTemplate {
  id: string;
  title: string;
  category: Category;
  defaultDurationMin: number;
  colorHex: string;
  goldenRuleKey?: GoldenRuleKey | null;
}

export interface PlacedBlock {
  id: string;
  templateId: string;
  week: number;
  day: Day;
  startTime: string;
  durationMin: number;
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
