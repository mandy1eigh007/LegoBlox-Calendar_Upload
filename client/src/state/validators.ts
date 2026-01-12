import { 
  AppState, 
  BlockTemplate, 
  Plan, 
  PlacedBlock, 
  ALLOWED_DURATIONS, 
  CATEGORIES, 
  DAYS, 
  GOLDEN_RULE_TOPICS,
  GoldenRuleTopic
} from './types';

export function isValidGoldenRuleTopic(topic: string): topic is GoldenRuleTopic {
  return GOLDEN_RULE_TOPICS.includes(topic as GoldenRuleTopic);
}

export function validateTemplate(template: unknown): template is BlockTemplate {
  if (!template || typeof template !== 'object') return false;
  const t = template as Record<string, unknown>;
  
  if (typeof t.id !== 'string' || !t.id) return false;
  if (typeof t.title !== 'string' || !t.title) return false;
  if (!CATEGORIES.includes(t.category as typeof CATEGORIES[number])) return false;
  if (!ALLOWED_DURATIONS.includes(t.defaultDurationMin as typeof ALLOWED_DURATIONS[number])) return false;
  if (typeof t.colorHex !== 'string') return false;
  if (!isValidGoldenRuleTopic(t.goldenRuleTopic as string)) return false;
  
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
  if (!ALLOWED_DURATIONS.includes(b.durationMin as typeof ALLOWED_DURATIONS[number])) return false;
  
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
    if (!isValidGoldenRuleTopic((template as BlockTemplate).goldenRuleTopic)) {
      return { valid: false, error: `Unknown Golden Rule topic: ${(template as BlockTemplate).goldenRuleTopic}` };
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
