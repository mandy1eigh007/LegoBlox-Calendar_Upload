import { BlockTemplate, GoldenRuleBucketId } from '@/state/types';

export interface TitleAlias {
  rawTitle: string;
  templateId: string;
  matchType: 'exact' | 'alias' | 'contains';
  notes?: string;
}

export interface TitleAliasConfig {
  aliases: TitleAlias[];
  version: number;
}

const STORAGE_KEY = 'cohort-schedule-title-aliases';

const DEFAULT_ALIASES: TitleAlias[] = [
  { rawTitle: 'Intro to Pre-Apprenticeship', templateId: 'intro_preapp', matchType: 'alias' },
  { rawTitle: 'Introduction to Pre apprenticeship', templateId: 'intro_preapp', matchType: 'alias' },
  { rawTitle: 'Introduction to Pre-Apprenticeship', templateId: 'intro_preapp', matchType: 'alias' },
  { rawTitle: 'Pre-Apprenticeship Intro', templateId: 'intro_preapp', matchType: 'alias' },
  
  { rawTitle: 'OSHA 10', templateId: 'osha10', matchType: 'contains' },
  { rawTitle: 'OSHA Day', templateId: 'osha10', matchType: 'contains' },
  { rawTitle: 'OSHA-10', templateId: 'osha10', matchType: 'alias' },
  
  { rawTitle: 'Resume', templateId: 'resumes', matchType: 'contains' },
  { rawTitle: 'Résumé', templateId: 'resumes', matchType: 'contains' },
  { rawTitle: 'Intro to Resume', templateId: 'resumes', matchType: 'alias' },
  { rawTitle: 'Resume Writing', templateId: 'resumes', matchType: 'alias' },
  
  { rawTitle: 'Interview', templateId: 'interviews', matchType: 'contains' },
  { rawTitle: 'Mock Interview', templateId: 'interviews', matchType: 'alias' },
  { rawTitle: 'Interview Skills', templateId: 'interviews', matchType: 'alias' },
  { rawTitle: 'Group Interview', templateId: 'interviews', matchType: 'alias' },
  
  { rawTitle: 'Shop Intro', templateId: 'shop_intro', matchType: 'alias' },
  { rawTitle: 'Shop Introduction', templateId: 'shop_intro', matchType: 'alias' },
  { rawTitle: 'Intro to Shop', templateId: 'shop_intro', matchType: 'alias' },
  { rawTitle: 'Shop Safety', templateId: 'shop_intro', matchType: 'alias' },
  
  { rawTitle: 'Scaffolding', templateId: 'scaffolding', matchType: 'contains' },
  { rawTitle: 'Intro to Scaffolding', templateId: 'scaffolding', matchType: 'alias' },
  
  { rawTitle: 'Hand Tool', templateId: 'hand_tools', matchType: 'contains' },
  { rawTitle: 'Power Tool', templateId: 'power_tools', matchType: 'contains' },
  
  { rawTitle: 'Measuring Tape', templateId: 'measuring_tape', matchType: 'contains' },
  { rawTitle: 'Tape Measure', templateId: 'measuring_tape', matchType: 'contains' },
  { rawTitle: 'Intro to Tape', templateId: 'measuring_tape', matchType: 'alias' },
  
  { rawTitle: 'ACES', templateId: 'aces', matchType: 'contains' },
  { rawTitle: 'ACE Instruction', templateId: 'ace_instruction', matchType: 'alias' },
  
  { rawTitle: 'Financial', templateId: 'financial_ed', matchType: 'contains' },
  { rawTitle: 'Financial Education', templateId: 'financial_ed', matchType: 'alias' },
  { rawTitle: 'Financial Literacy', templateId: 'financial_ed', matchType: 'alias' },
  
  { rawTitle: 'Elevator Pitch', templateId: 'elevator_pitch', matchType: 'alias' },
  
  { rawTitle: 'Grit', templateId: 'grit_growth', matchType: 'contains' },
  { rawTitle: 'Growth Mindset', templateId: 'grit_growth', matchType: 'alias' },
  
  { rawTitle: 'Emotional Intelligence', templateId: 'emotional_intel', matchType: 'alias' },
  
  { rawTitle: 'Portfolio', templateId: 'portfolio', matchType: 'contains' },
  { rawTitle: 'Apprenticeship Portfolio', templateId: 'portfolio', matchType: 'alias' },
  
  { rawTitle: 'Career Plan', templateId: 'career_plan', matchType: 'contains' },
  { rawTitle: 'Individual Career Plan', templateId: 'career_plan', matchType: 'alias' },
  { rawTitle: 'ICP', templateId: 'career_plan', matchType: 'alias' },
  
  { rawTitle: 'Labor History', templateId: 'labor_history', matchType: 'alias' },
  { rawTitle: 'Union History', templateId: 'labor_history', matchType: 'alias' },
  
  { rawTitle: 'Ladder Safety', templateId: 'ladder_safety', matchType: 'alias' },
  
  { rawTitle: 'Clean Energy', templateId: 'clean_energy', matchType: 'contains' },
  { rawTitle: 'Renewable', templateId: 'clean_energy', matchType: 'contains' },
  
  { rawTitle: 'Forklift', templateId: 'forklift', matchType: 'contains' },
  { rawTitle: 'Flagger', templateId: 'flagger', matchType: 'contains' },
  
  { rawTitle: 'Fitness', templateId: 'physical_fitness', matchType: 'contains' },
  { rawTitle: 'Workout', templateId: 'physical_fitness', matchType: 'contains' },
  { rawTitle: 'Work Out', templateId: 'physical_fitness', matchType: 'alias' },
  { rawTitle: 'PT', templateId: 'physical_fitness', matchType: 'alias' },
  { rawTitle: 'Physical Training', templateId: 'physical_fitness', matchType: 'alias' },
  
  { rawTitle: 'Nutrition', templateId: 'nutrition', matchType: 'contains' },
  
  { rawTitle: 'Lunch', templateId: 'lunch', matchType: 'alias' },
  { rawTitle: 'Break', templateId: 'break', matchType: 'alias' },
  
  { rawTitle: 'Tour', templateId: 'apprentice_tours', matchType: 'contains' },
  { rawTitle: 'Worksite Tour', templateId: 'worksite_tours', matchType: 'alias' },
  { rawTitle: 'Job Site', templateId: 'worksite_tours', matchType: 'contains' },
  { rawTitle: 'Field Trip', templateId: 'worksite_tours', matchType: 'alias' },
  
  { rawTitle: 'Speaker', templateId: 'speaker_presentations', matchType: 'contains' },
  { rawTitle: 'Presentation', templateId: 'speaker_presentations', matchType: 'contains' },
  { rawTitle: 'Guest Speaker', templateId: 'speaker_presentations', matchType: 'alias' },
  
  { rawTitle: 'Professional Development', templateId: 'pd_principles', matchType: 'alias' },
  { rawTitle: 'PD', templateId: 'pd_principles', matchType: 'alias' },
  
  { rawTitle: 'Trade Awareness', templateId: 'trade_awareness', matchType: 'alias' },
  { rawTitle: 'Construction Trades', templateId: 'construction_trades', matchType: 'alias' },
  { rawTitle: 'Intro to Construction', templateId: 'construction_trades', matchType: 'alias' },
  
  { rawTitle: 'Workers Comp', templateId: 'workers_comp', matchType: 'alias' },
  { rawTitle: 'Unemployment', templateId: 'workers_comp', matchType: 'contains' },
  
  { rawTitle: 'RISE Up', templateId: 'rise_up', matchType: 'alias' },
  { rawTitle: 'Bystander', templateId: 'rise_up', matchType: 'contains' },
  
  { rawTitle: 'Skills Project', templateId: 'skills_project', matchType: 'contains' },
  
  { rawTitle: 'Application Prep', templateId: 'app_prep', matchType: 'alias' },
  { rawTitle: 'App Prep', templateId: 'app_prep', matchType: 'alias' },
  
  { rawTitle: 'Job Search', templateId: 'apply_apprenticeships', matchType: 'contains' },
  { rawTitle: 'Applying', templateId: 'apply_apprenticeships', matchType: 'contains' },
  
  { rawTitle: 'Materials', templateId: 'materials', matchType: 'alias' },
  { rawTitle: 'Construction Materials', templateId: 'materials', matchType: 'alias' },
  
  { rawTitle: 'Successful Apprentice', templateId: 'successful_apprentice', matchType: 'alias' },
  { rawTitle: 'How to be a Successful', templateId: 'successful_apprentice', matchType: 'contains' },
];

const BUCKET_ID_TO_TEMPLATE_ID: Record<GoldenRuleBucketId, string> = {
  'INTRO_PREAPP': 'intro_preapp',
  'PD_PRINCIPLES': 'pd_principles',
  'GRIT_GROWTH': 'grit_growth',
  'SUCCESSFUL_APPRENTICE': 'successful_apprentice',
  'ELEVATOR_PITCH': 'elevator_pitch',
  'RESUMES': 'resumes',
  'INTERVIEWS': 'interviews',
  'APPLY_APPRENTICESHIPS': 'apply_apprenticeships',
  'FINANCIAL_ED': 'financial_ed',
  'EMOTIONAL_INTEL': 'emotional_intel',
  'RISE_UP': 'rise_up',
  'WORKERS_COMP': 'workers_comp',
  'PORTFOLIO': 'portfolio',
  'CAREER_PLAN': 'career_plan',
  'APP_PREP': 'app_prep',
  'MATH': 'math',
  'ACE_INSTRUCTION': 'ace_instruction',
  'ACES': 'aces',
  'SHOP_INTRO': 'shop_intro',
  'CONSTRUCTION_TRADES': 'construction_trades',
  'TRADE_AWARENESS': 'trade_awareness',
  'LABOR_HISTORY': 'labor_history',
  'HAND_TOOLS': 'hand_tools',
  'POWER_TOOLS': 'power_tools',
  'MATERIALS': 'materials',
  'MEASURING_TAPE': 'measuring_tape',
  'SKILLS_PROJECT': 'skills_project',
  'SCAFFOLDING': 'scaffolding',
  'LADDER_SAFETY': 'ladder_safety',
  'CLEAN_ENERGY': 'clean_energy',
  'APPRENTICE_TOURS': 'apprentice_tours',
  'WORKSITE_TOURS': 'worksite_tours',
  'SPEAKER_PRESENTATIONS': 'speaker_presentations',
  'OSHA_10': 'osha10',
  'FORKLIFT': 'forklift',
  'FLAGGER': 'flagger',
  'PHYSICAL_FITNESS': 'physical_fitness',
  'NUTRITION': 'nutrition',
};

const TEMPLATE_KEY_TO_BUCKET_ID = Object.entries(BUCKET_ID_TO_TEMPLATE_ID).reduce((acc, [bucketId, templateKey]) => {
  acc[templateKey] = bucketId as GoldenRuleBucketId;
  return acc;
}, {} as Record<string, GoldenRuleBucketId>);

function normalizeAliasKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveAliasTemplateId(
  aliasTemplateId: string,
  aliasTitle: string,
  templates: BlockTemplate[]
): string | null {
  const direct = templates.find(t => t.id === aliasTemplateId);
  if (direct) return direct.id;

  const bucketId = TEMPLATE_KEY_TO_BUCKET_ID[normalizeAliasKey(aliasTemplateId)];
  if (bucketId) {
    const bucketTemplate = templates.find(t => t.goldenRuleBucketId === bucketId && t.countsTowardGoldenRule);
    if (bucketTemplate) return bucketTemplate.id;
  }

  const normalizedTitle = normalizeAliasKey(aliasTitle);
  const titleExact = templates.find(t => normalizeAliasKey(t.title) === normalizedTitle);
  if (titleExact) return titleExact.id;

  const titleContains = templates.find(t => {
    const templateTitle = normalizeAliasKey(t.title);
    return templateTitle.includes(normalizedTitle) || normalizedTitle.includes(templateTitle);
  });

  return titleContains?.id ?? null;
}

export function loadTitleAliases(): TitleAliasConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed;
    }
  } catch {
    console.warn('Failed to load title aliases, using defaults');
  }
  return { aliases: DEFAULT_ALIASES, version: 1 };
}

export function saveTitleAliases(config: TitleAliasConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function addTitleAlias(alias: TitleAlias): void {
  const config = loadTitleAliases();
  const existingIndex = config.aliases.findIndex(
    a => a.rawTitle.toLowerCase() === alias.rawTitle.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    config.aliases[existingIndex] = alias;
  } else {
    config.aliases.push(alias);
  }
  
  saveTitleAliases(config);
}

export function removeTitleAlias(rawTitle: string): void {
  const config = loadTitleAliases();
  config.aliases = config.aliases.filter(
    a => a.rawTitle.toLowerCase() !== rawTitle.toLowerCase()
  );
  saveTitleAliases(config);
}

export function matchTitleToTemplateViaAlias(
  title: string,
  templates: BlockTemplate[]
): { templateId: string | null; matchType: 'exact' | 'alias' | 'contains' | 'none'; aliasUsed?: string } {
  const config = loadTitleAliases();
  const normalizedTitle = title.toLowerCase().trim();
  
  for (const alias of config.aliases) {
    const normalizedAlias = alias.rawTitle.toLowerCase().trim();
    const resolvedTemplateId = resolveAliasTemplateId(alias.templateId, alias.rawTitle, templates);
    if (!resolvedTemplateId) continue;
    
    if (alias.matchType === 'exact' || alias.matchType === 'alias') {
      if (normalizedTitle === normalizedAlias) {
        return { templateId: resolvedTemplateId, matchType: alias.matchType, aliasUsed: alias.rawTitle };
      }
    }
    
    if (alias.matchType === 'contains') {
      if (normalizedTitle.includes(normalizedAlias)) {
        return { templateId: resolvedTemplateId, matchType: 'contains', aliasUsed: alias.rawTitle };
      }
    }
  }
  
  for (const alias of config.aliases) {
    if (alias.matchType === 'alias') {
      const normalizedAlias = alias.rawTitle.toLowerCase().trim();
      const resolvedTemplateId = resolveAliasTemplateId(alias.templateId, alias.rawTitle, templates);
      if (!resolvedTemplateId) continue;
      if (normalizedTitle.includes(normalizedAlias) || normalizedAlias.includes(normalizedTitle)) {
        return { templateId: resolvedTemplateId, matchType: 'alias', aliasUsed: alias.rawTitle };
      }
    }
  }
  
  return { templateId: null, matchType: 'none' };
}

export function parseAliasCSV(csvContent: string): TitleAlias[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const aliases: TitleAlias[] = [];
  
  const headerLine = lines[0]?.toLowerCase();
  if (!headerLine?.includes('raw_title') && !headerLine?.includes('rawtitle')) {
    return [];
  }
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2) {
      const rawTitle = parts[0];
      const templateId = parts[1];
      const matchType = (parts[2] as 'exact' | 'alias' | 'contains') || 'alias';
      const notes = parts[3] || '';
      
      if (rawTitle && templateId) {
        aliases.push({ rawTitle, templateId, matchType, notes });
      }
    }
  }
  
  return aliases;
}

export function importAliasCSV(csvContent: string): number {
  const newAliases = parseAliasCSV(csvContent);
  if (newAliases.length === 0) return 0;
  
  const config = loadTitleAliases();
  
  for (const alias of newAliases) {
    const existingIndex = config.aliases.findIndex(
      a => a.rawTitle.toLowerCase() === alias.rawTitle.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      config.aliases[existingIndex] = alias;
    } else {
      config.aliases.push(alias);
    }
  }
  
  saveTitleAliases(config);
  return newAliases.length;
}

export function exportAliasCSV(): string {
  const config = loadTitleAliases();
  const lines = ['raw_title,template_id,match_type,notes'];
  
  for (const alias of config.aliases) {
    lines.push(`"${alias.rawTitle}","${alias.templateId}","${alias.matchType}","${alias.notes || ''}"`);
  }
  
  return lines.join('\n');
}

export function getBucketIdForTemplateId(templateId: string): GoldenRuleBucketId | null {
  for (const [bucketId, tId] of Object.entries(BUCKET_ID_TO_TEMPLATE_ID)) {
    if (tId === templateId) {
      return bucketId as GoldenRuleBucketId;
    }
  }
  return null;
}

export function getTemplateIdForBucketId(bucketId: GoldenRuleBucketId): string {
  return BUCKET_ID_TO_TEMPLATE_ID[bucketId] || bucketId.toLowerCase();
}
