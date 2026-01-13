import { BlockTemplate, GoldenRuleKey, Category, COLOR_PALETTE } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

interface SeedTemplate {
  title: string;
  duration: number;
  category: Category;
  goldenRuleKey?: GoldenRuleKey | null;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  { title: 'Work Out', duration: 60, category: 'Other', goldenRuleKey: 'PHYSICAL_FITNESS' },
  { title: 'Lunch', duration: 60, category: 'Admin', goldenRuleKey: null },
  { title: 'OSHA 10', duration: 300, category: 'Certification', goldenRuleKey: 'OSHA_10' },
  { title: 'Intro to Pre-Apprenticeship', duration: 180, category: 'PD', goldenRuleKey: 'INTRO_PREAPP' },
  { title: 'Support Services Intake and Intro', duration: 90, category: 'Support Services', goldenRuleKey: 'INTRO_PREAPP' },
  { title: 'Intro into ACES', duration: 120, category: 'Shop', goldenRuleKey: 'ACE_INSTRUCTION' },
  { title: 'Intro into Tape Measure for ACES', duration: 60, category: 'Shop', goldenRuleKey: 'MEASURING_TAPE' },
  { title: 'Mock Interview Prep', duration: 120, category: 'PD', goldenRuleKey: 'INTERVIEWS' },
  { title: 'Group Interviewing', duration: 120, category: 'PD', goldenRuleKey: 'INTERVIEWS' },
  { title: 'ACEs', duration: 120, category: 'Shop', goldenRuleKey: 'ACES' },
  { title: 'Crate Project', duration: 240, category: 'Shop', goldenRuleKey: 'SKILLS_PROJECTS' },
  { title: 'Forklift', duration: 480, category: 'Certification', goldenRuleKey: 'FORKLIFT' },
  { title: 'Try outs', duration: 120, category: 'PD', goldenRuleKey: 'PD_PRINCIPLES' },
  { title: 'Hand tool test', duration: 60, category: 'Shop', goldenRuleKey: 'HAND_TOOLS' },
  { title: 'Power tool test', duration: 60, category: 'Shop', goldenRuleKey: 'POWER_TOOLS' },
  { title: 'Construction Math', duration: 120, category: 'Math', goldenRuleKey: 'PD_PRINCIPLES' },
  { title: 'Graduation', duration: 120, category: 'Admin', goldenRuleKey: null },
  { title: 'Grit/Growth Mindset', duration: 60, category: 'PD', goldenRuleKey: 'GRIT_GROWTH' },
  { title: 'Successful Apprentice', duration: 60, category: 'PD', goldenRuleKey: 'SUCCESSFUL_APPRENTICE' },
  { title: 'Elevator Pitch', duration: 120, category: 'PD', goldenRuleKey: 'ELEVATOR_PITCH' },
  { title: 'Resume Workshop', duration: 240, category: 'PD', goldenRuleKey: 'RESUMES' },
  { title: 'Job Search Strategies', duration: 180, category: 'PD', goldenRuleKey: 'APPLY_APPRENTICESHIPS' },
];

const CATEGORY_COLORS: Record<Category, string> = {
  'PD': COLOR_PALETTE[0].hex,
  'Shop': COLOR_PALETTE[1].hex,
  'Math': COLOR_PALETTE[4].hex,
  'Admin': COLOR_PALETTE[9].hex,
  'Tour': COLOR_PALETTE[7].hex,
  'Certification': COLOR_PALETTE[5].hex,
  'Support Services': COLOR_PALETTE[6].hex,
  'Other': COLOR_PALETTE[8].hex,
};

export function createSeedTemplates(): BlockTemplate[] {
  return SEED_TEMPLATES.map(seed => ({
    id: uuidv4(),
    title: seed.title,
    category: seed.category,
    defaultDurationMin: seed.duration,
    colorHex: CATEGORY_COLORS[seed.category],
    goldenRuleKey: seed.goldenRuleKey,
  }));
}
