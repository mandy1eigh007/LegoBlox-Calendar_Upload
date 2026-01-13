import { BlockTemplate, Category, COLOR_PALETTE, GoldenRuleBucketId } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

interface SeedTemplate {
  title: string;
  category: Category;
  defaultDurationMinutes: number;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | null;
  defaultLocation?: string;
  defaultNotes?: string;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  { title: 'Work Out', category: 'Other', defaultDurationMinutes: 60, countsTowardGoldenRule: true, goldenRuleBucketId: 'PHYSICAL_FITNESS', defaultLocation: 'Shop' },
  { title: 'Lunch', category: 'Admin', defaultDurationMinutes: 60, countsTowardGoldenRule: false, goldenRuleBucketId: null },
  { title: 'OSHA 10', category: 'Certification', defaultDurationMinutes: 300, countsTowardGoldenRule: true, goldenRuleBucketId: 'OSHA_10', defaultLocation: 'Classroom 1' },
  { title: 'Intro to Pre-Apprenticeship', category: 'PD', defaultDurationMinutes: 180, countsTowardGoldenRule: true, goldenRuleBucketId: 'INTRO_PREAPP', defaultLocation: 'Classroom 1' },
  { title: 'Support Services Intake and Intro', category: 'Support Services', defaultDurationMinutes: 90, countsTowardGoldenRule: true, goldenRuleBucketId: 'INTRO_PREAPP', defaultLocation: 'Administration' },
  { title: 'Intro into ACES', category: 'Shop', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'ACE_INSTRUCTION', defaultLocation: 'Shop' },
  { title: 'Intro into Tape Measure for ACES', category: 'Shop', defaultDurationMinutes: 60, countsTowardGoldenRule: true, goldenRuleBucketId: 'MEASURING_TAPE', defaultLocation: 'Shop' },
  { title: 'ACEs', category: 'Shop', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'ACES', defaultLocation: 'Shop' },
  { title: 'Grit/Growth Mindset', category: 'PD', defaultDurationMinutes: 60, countsTowardGoldenRule: true, goldenRuleBucketId: 'GRIT_GROWTH', defaultLocation: 'Classroom 1' },
  { title: 'Successful Apprentice', category: 'PD', defaultDurationMinutes: 60, countsTowardGoldenRule: true, goldenRuleBucketId: 'SUCCESSFUL_APPRENTICE', defaultLocation: 'Classroom 1' },
  { title: 'Elevator Pitch', category: 'PD', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'ELEVATOR_PITCH', defaultLocation: 'Classroom 1' },
  { title: 'Resume Workshop', category: 'PD', defaultDurationMinutes: 240, countsTowardGoldenRule: true, goldenRuleBucketId: 'RESUMES', defaultLocation: 'Classroom 1' },
  { title: 'Interview Skills', category: 'PD', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'INTERVIEWS', defaultLocation: 'Classroom 1' },
  { title: 'Group Interviews', category: 'PD', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'INTERVIEWS', defaultLocation: 'Classroom 1' },
  { title: 'Mock Interview Prep', category: 'PD', defaultDurationMinutes: 120, countsTowardGoldenRule: true, goldenRuleBucketId: 'INTERVIEWS', defaultLocation: 'Classroom 1' },
  { title: 'Job Search Strategies', category: 'PD', defaultDurationMinutes: 180, countsTowardGoldenRule: true, goldenRuleBucketId: 'APPLY_APPRENTICESHIPS', defaultLocation: 'Classroom 1' },
  { title: 'Hand Tools', category: 'Shop', defaultDurationMinutes: 180, countsTowardGoldenRule: true, goldenRuleBucketId: 'HAND_TOOLS', defaultLocation: 'Shop' },
  { title: 'Power Tools', category: 'Shop', defaultDurationMinutes: 180, countsTowardGoldenRule: true, goldenRuleBucketId: 'POWER_TOOLS', defaultLocation: 'Shop' },
  { title: 'Skills Project', category: 'Shop', defaultDurationMinutes: 240, countsTowardGoldenRule: true, goldenRuleBucketId: 'SKILLS_PROJECT', defaultLocation: 'Shop' },
  { title: 'Apprenticeship Tour', category: 'Other', defaultDurationMinutes: 240, countsTowardGoldenRule: true, goldenRuleBucketId: 'APPRENTICE_TOURS', defaultLocation: 'Offsite' },
  { title: 'Forklift', category: 'Certification', defaultDurationMinutes: 480, countsTowardGoldenRule: true, goldenRuleBucketId: 'FORKLIFT', defaultLocation: 'Shop' },
];

const CATEGORY_COLORS: Record<Category, string> = {
  'PD': COLOR_PALETTE[0].hex,
  'Shop': COLOR_PALETTE[1].hex,
  'Math': COLOR_PALETTE[4].hex,
  'Admin': COLOR_PALETTE[9].hex,
  'Certification': COLOR_PALETTE[5].hex,
  'Support Services': COLOR_PALETTE[6].hex,
  'Other': COLOR_PALETTE[7].hex,
};

export function createSeedTemplates(): BlockTemplate[] {
  return SEED_TEMPLATES.map(seed => ({
    id: uuidv4(),
    title: seed.title,
    category: seed.category,
    colorHex: CATEGORY_COLORS[seed.category],
    defaultDurationMinutes: seed.defaultDurationMinutes,
    countsTowardGoldenRule: seed.countsTowardGoldenRule,
    goldenRuleBucketId: seed.goldenRuleBucketId,
    defaultLocation: seed.defaultLocation || '',
    defaultNotes: seed.defaultNotes || '',
  }));
}
