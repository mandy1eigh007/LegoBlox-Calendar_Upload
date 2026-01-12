import { BlockTemplate, GoldenRuleTopic, Category, AllowedDuration, COLOR_PALETTE } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

interface SeedTemplate {
  title: string;
  duration: AllowedDuration;
  category: Category;
  goldenRuleTopic: GoldenRuleTopic;
}

const SEED_TEMPLATES: SeedTemplate[] = [
  { title: 'Work Out', duration: 60, category: 'Other', goldenRuleTopic: 'Physical Fitness' },
  { title: 'Lunch', duration: 60, category: 'Admin', goldenRuleTopic: 'Professional Development Principles (Intro/Mid/Final)' },
  { title: 'OSHA 10', duration: 300, category: 'Certification', goldenRuleTopic: 'OSHA 10' },
  { title: 'Intro to Pre-Apprenticeship', duration: 180, category: 'PD', goldenRuleTopic: 'Introduction to Pre-Apprenticeship' },
  { title: 'Support Services Intake and Intro', duration: 90, category: 'Support Services', goldenRuleTopic: 'Professional Development Principles (Intro/Mid/Final)' },
  { title: 'Intro into ACES', duration: 120, category: 'Shop', goldenRuleTopic: 'ACE Instruction' },
  { title: 'Intro into Tape Measure for ACES', duration: 60, category: 'Shop', goldenRuleTopic: 'Intro to Measuring Tape + Measuring Tape Exercises' },
  { title: 'Mock Interview Prep', duration: 120, category: 'PD', goldenRuleTopic: 'Interviews (Interview Skills + Group Interviews + Mock Prep)' },
  { title: 'Group Interviewing', duration: 120, category: 'PD', goldenRuleTopic: 'Interviews (Interview Skills + Group Interviews + Mock Prep)' },
  { title: 'ACEs', duration: 120, category: 'Shop', goldenRuleTopic: 'ACEs' },
  { title: 'Crate Project', duration: 240, category: 'Shop', goldenRuleTopic: 'Skills Projects (Crate/Anchor/Saw Horse/Wall)' },
  { title: 'Forklift', duration: 480, category: 'Certification', goldenRuleTopic: 'Forklift' },
  { title: 'Try outs', duration: 120, category: 'PD', goldenRuleTopic: 'Professional Development Principles (Intro/Mid/Final)' },
  { title: 'Hand tool test', duration: 60, category: 'Shop', goldenRuleTopic: 'Hand Tools' },
  { title: 'Power tool test', duration: 60, category: 'Shop', goldenRuleTopic: 'Power Tools' },
  { title: 'Construction Math', duration: 120, category: 'Math', goldenRuleTopic: 'Professional Development Principles (Intro/Mid/Final)' },
  { title: 'Graduation', duration: 120, category: 'Admin', goldenRuleTopic: 'Professional Development Principles (Intro/Mid/Final)' },
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
    goldenRuleTopic: seed.goldenRuleTopic,
  }));
}
