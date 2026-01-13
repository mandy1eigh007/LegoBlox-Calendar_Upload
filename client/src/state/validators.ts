import { 
  AppState, 
  BlockTemplate, 
  Plan, 
  PlacedBlock, 
  CATEGORIES, 
  DAYS, 
  GOLDEN_RULE_KEYS,
  GoldenRuleKey
} from './types';

export function isValidGoldenRuleKey(key: string): key is GoldenRuleKey {
  return GOLDEN_RULE_KEYS.includes(key as GoldenRuleKey);
}

export function validateTemplate(template: unknown): template is BlockTemplate {
  if (!template || typeof template !== 'object') return false;
  const t = template as Record<string, unknown>;
  
  if (typeof t.id !== 'string' || !t.id) return false;
  if (typeof t.title !== 'string' || !t.title) return false;
  if (!CATEGORIES.includes(t.category as typeof CATEGORIES[number])) return false;
  if (typeof t.defaultDurationMin !== 'number' || t.defaultDurationMin < 15) return false;
  if (typeof t.colorHex !== 'string') return false;
  
  if (t.goldenRuleKey !== null && t.goldenRuleKey !== undefined) {
    if (!isValidGoldenRuleKey(t.goldenRuleKey as string)) return false;
  }
  
  return true;
}

export function validatePlacedBlock(block: unknown): block is PlacedBlock {
  if (!block || typeof block !== 'object') return false;
  const b = block as Record<string, unknown>;
  
  if (typeof b.id !== 'string' || !b.id) return false;
  if (typeof b.templateId !== 'string' || !b.templateId) return false;
  if (typeof b.week !== 'number' || b.week < 1) return false;
  if (!DAYS.includes(b.day as typeof DAYS[number])) return false;
  if (typeof b.startTime !== 'string') return false;
  if (typeof b.durationMin !== 'number' || b.durationMin < 15) return false;
  
  return true;
}

export function validatePlan(plan: unknown): plan is Plan {
  if (!plan || typeof plan !== 'object') return false;
  const p = plan as Record<string, unknown>;
  
  if (typeof p.id !== 'string' || !p.id) return false;
  if (!p.settings || typeof p.settings !== 'object') return false;
  
  const s = p.settings as Record<string, unknown>;
  if (typeof s.name !== 'string' || !s.name) return false;
  if (typeof s.weeks !== 'number' || s.weeks < 1) return false;
  if (!Array.isArray(s.enabledDays)) return false;
  
  if (!Array.isArray(p.blocks)) return false;
  for (const block of p.blocks) {
    if (!validatePlacedBlock(block)) return false;
  }
  
  return true;
}

export function validateAppState(state: unknown): { valid: boolean; error?: string } {
  if (!state || typeof state !== 'object') {
    return { valid: false, error: 'Invalid state format' };
  }
  
  const s = state as Record<string, unknown>;
  
  if (s.version !== 1) {
    return { valid: false, error: 'Unsupported version' };
  }
  
  if (!Array.isArray(s.templates)) {
    return { valid: false, error: 'Invalid templates array' };
  }
  
  for (const template of s.templates) {
    if (!validateTemplate(template)) {
      return { valid: false, error: `Invalid template: ${JSON.stringify(template)}` };
    }
  }
  
  if (!Array.isArray(s.plans)) {
    return { valid: false, error: 'Invalid plans array' };
  }
  
  for (const plan of s.plans) {
    if (!validatePlan(plan)) {
      return { valid: false, error: `Invalid plan: ${JSON.stringify(plan)}` };
    }
  }
  
  return { valid: true };
}
