import { BlockTemplate, Category, COLOR_PALETTE, GOLDEN_RULE_BUCKETS, GoldenRuleBucket, GoldenRuleBucketId } from '@/state/types';
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

const BUCKET_CATEGORY_MAP: Record<GoldenRuleBucketId, Category> = {
  'INTRO_PREAPP': 'PD',
  'PD_PRINCIPLES': 'PD',
  'GRIT_GROWTH': 'PD',
  'SUCCESSFUL_APPRENTICE': 'PD',
  'ELEVATOR_PITCH': 'PD',
  'RESUMES': 'PD',
  'INTERVIEWS': 'PD',
  'APPLY_APPRENTICESHIPS': 'PD',
  'FINANCIAL_ED': 'PD',
  'EMOTIONAL_INTEL': 'PD',
  'RISE_UP': 'PD',
  'WORKERS_COMP': 'PD',
  'PORTFOLIO': 'PD',
  'CAREER_PLAN': 'PD',
  'APP_PREP': 'PD',
  'MATH': 'Math',
  'ACE_INSTRUCTION': 'Shop',
  'ACES': 'Shop',
  'SHOP_INTRO': 'Shop',
  'CONSTRUCTION_TRADES': 'Shop',
  'TRADE_AWARENESS': 'Shop',
  'LABOR_HISTORY': 'Shop',
  'HAND_TOOLS': 'Shop',
  'POWER_TOOLS': 'Shop',
  'MATERIALS': 'Shop',
  'MEASURING_TAPE': 'Shop',
  'SKILLS_PROJECT': 'Shop',
  'SCAFFOLDING': 'Shop',
  'LADDER_SAFETY': 'Shop',
  'CLEAN_ENERGY': 'Shop',
  'APPRENTICE_TOURS': 'Other',
  'WORKSITE_TOURS': 'Other',
  'SPEAKER_PRESENTATIONS': 'Other',
  'OSHA_10': 'Certification',
  'FORKLIFT': 'Certification',
  'FLAGGER': 'Certification',
  'PHYSICAL_FITNESS': 'Other',
  'NUTRITION': 'Other',
};

const BUCKET_LOCATION_MAP: Partial<Record<GoldenRuleBucketId, string>> = {
  'INTRO_PREAPP': 'Classroom 1',
  'PD_PRINCIPLES': 'Classroom 1',
  'GRIT_GROWTH': 'Classroom 1',
  'SUCCESSFUL_APPRENTICE': 'Classroom 1',
  'ELEVATOR_PITCH': 'Classroom 1',
  'RESUMES': 'Classroom 1',
  'INTERVIEWS': 'Classroom 1',
  'APPLY_APPRENTICESHIPS': 'Classroom 1',
  'FINANCIAL_ED': 'Classroom 1',
  'EMOTIONAL_INTEL': 'Classroom 1',
  'RISE_UP': 'Classroom 1',
  'WORKERS_COMP': 'Classroom 1',
  'PORTFOLIO': 'Classroom 1',
  'CAREER_PLAN': 'Classroom 1',
  'APP_PREP': 'Classroom 1',
  'MATH': 'Classroom 2',
  'ACE_INSTRUCTION': 'Shop',
  'ACES': 'Shop',
  'SHOP_INTRO': 'Shop',
  'CONSTRUCTION_TRADES': 'Shop',
  'TRADE_AWARENESS': 'Shop',
  'LABOR_HISTORY': 'Classroom 1',
  'HAND_TOOLS': 'Shop',
  'POWER_TOOLS': 'Shop',
  'MATERIALS': 'Shop',
  'MEASURING_TAPE': 'Shop',
  'SKILLS_PROJECT': 'Shop',
  'SCAFFOLDING': 'Shop',
  'LADDER_SAFETY': 'Shop',
  'CLEAN_ENERGY': 'Classroom 1',
  'APPRENTICE_TOURS': 'Offsite',
  'WORKSITE_TOURS': 'Offsite',
  'SPEAKER_PRESENTATIONS': 'Classroom 1',
  'OSHA_10': 'Classroom 1',
  'FORKLIFT': 'Shop',
  'FLAGGER': 'Offsite',
  'PHYSICAL_FITNESS': 'Shop',
  'NUTRITION': 'Classroom 1',
};

function createGoldenRuleTemplates(): SeedTemplate[] {
  const buckets = GOLDEN_RULE_BUCKETS as ReadonlyArray<GoldenRuleBucket>;
  return buckets.map(bucket => ({
    title: bucket.label,
    category: BUCKET_CATEGORY_MAP[bucket.id as GoldenRuleBucketId],
    defaultDurationMinutes: bucket.isFlexible ? 120 : Math.min(bucket.budgetMinutes, 240),
    countsTowardGoldenRule: true,
    goldenRuleBucketId: bucket.id as GoldenRuleBucketId,
    defaultLocation: BUCKET_LOCATION_MAP[bucket.id as GoldenRuleBucketId] || '',
  }));
}

const ADMIN_TEMPLATES: SeedTemplate[] = [
  { title: 'Lunch', category: 'Admin', defaultDurationMinutes: 60, countsTowardGoldenRule: false, goldenRuleBucketId: null },
  { title: 'Break', category: 'Admin', defaultDurationMinutes: 15, countsTowardGoldenRule: false, goldenRuleBucketId: null },
  { title: 'Check-In', category: 'Admin', defaultDurationMinutes: 15, countsTowardGoldenRule: false, goldenRuleBucketId: null },
  { title: 'Dismissal', category: 'Admin', defaultDurationMinutes: 15, countsTowardGoldenRule: false, goldenRuleBucketId: null },
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
  const unassignedSeed: SeedTemplate = {
    title: 'Unassigned',
    category: 'Other',
    defaultDurationMinutes: 15,
    countsTowardGoldenRule: false,
    goldenRuleBucketId: null,
    defaultLocation: '',
    defaultNotes: '',
  };
  const allTemplates = [unassignedSeed, ...createGoldenRuleTemplates(), ...ADMIN_TEMPLATES];

  return allTemplates.map((seed, idx) => ({
    id: seed.title === 'Unassigned' ? 'UNASSIGNED' : uuidv4(),
    title: seed.title,
    category: seed.category,
    colorHex: CATEGORY_COLORS[seed.category],
    defaultDurationMinutes: seed.defaultDurationMinutes,
    countsTowardGoldenRule: seed.countsTowardGoldenRule,
    goldenRuleBucketId: seed.goldenRuleBucketId,
    defaultLocation: seed.defaultLocation || '',
    defaultNotes: seed.defaultNotes || '',
    isArchived: false,
  }));
}
