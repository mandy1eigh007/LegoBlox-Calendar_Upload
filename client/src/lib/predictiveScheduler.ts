import { v4 as uuidv4 } from 'uuid';
import { 
  PlacedBlock, 
  BlockTemplate, 
  Plan, 
  Day, 
  DAYS, 
  GOLDEN_RULE_BUCKETS,
  GoldenRuleBucketId,
  PlanSettings,
} from '@/state/types';
import { calculateGoldenRuleTotals } from './goldenRule';
import { loadProbabilityTable, getProbability, minutesToTimeBucket, ContextKey, trainFromBlocks, getProbabilityTableStats } from './probabilityLearning';

export interface SchedulerConfig {
  targetWeek: number;
  totalWeeks: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  slotMinutes: number;
  preferredBlockDuration: number;
  maxBlockDuration: number;
  distributeAcrossWeeks: boolean;
  hardDates?: { week: number; day: Day }[];
}

export interface SuggestedBlock extends PlacedBlock {
  isNew: boolean;
  bucketLabel: string;
  confidence?: number;
  reason?: string;
}

export interface SchedulerResult {
  suggestions: SuggestedBlock[];
  coverage: { bucketId: GoldenRuleBucketId; label: string; needed: number; scheduled: number; gap: number }[];
  conflicts: string[];
  stats: { totalBlocks: number; totalMinutes: number; filledSlots: number; emptySlots: number };
}

const DEFAULT_CONFIG: SchedulerConfig = {
  targetWeek: 1,
  totalWeeks: 9,
  dayStartMinutes: 390,
  dayEndMinutes: 930,
  slotMinutes: 15,
  preferredBlockDuration: 60,
  maxBlockDuration: 180,
  distributeAcrossWeeks: true,
};

type TimeSlot = { week: number; day: Day; startMinutes: number; endMinutes: number };

function getAvailableSlots(
  plan: Plan,
  week: number,
  config: SchedulerConfig
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const existingBlocks = plan.blocks.filter(b => b.week === week);
  const hardDates = config.hardDates || [];
  
  for (const day of DAYS) {
    // Skip hard dates - don't schedule on these days
    const isHardDate = hardDates.some(hd => hd.week === week && hd.day === day);
    if (isHardDate) continue;
    
    let currentTime = config.dayStartMinutes;
    
    const dayBlocks = existingBlocks
      .filter(b => b.day === day)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    
    for (const block of dayBlocks) {
      if (currentTime < block.startMinutes) {
        slots.push({
          week,
          day,
          startMinutes: currentTime,
          endMinutes: block.startMinutes,
        });
      }
      currentTime = Math.max(currentTime, block.startMinutes + block.durationMinutes);
    }
    
    if (currentTime < config.dayEndMinutes) {
      slots.push({
        week,
        day,
        startMinutes: currentTime,
        endMinutes: config.dayEndMinutes,
      });
    }
  }
  
  return slots;
}

function findTemplateForBucket(
  bucketId: GoldenRuleBucketId,
  templates: BlockTemplate[]
): BlockTemplate | null {
  return templates.find(t => t.goldenRuleBucketId === bucketId && t.countsTowardGoldenRule) || null;
}

function scoreSlotForTemplate(
  slot: TimeSlot,
  template: BlockTemplate,
  templates: BlockTemplate[]
): { score: number; reason: string } {
  const probTable = loadProbabilityTable();
  
  if (probTable.totalEvents === 0) {
    return { score: 0.5, reason: 'No training data' };
  }
  
  const context: ContextKey = {
    weekIndex: slot.week,
    dayOfWeek: slot.day,
    timeBucket: minutesToTimeBucket(slot.startMinutes),
  };
  
  const prob = getProbability(probTable, template.id, context, templates.length);
  const reason = `P=${(prob * 100).toFixed(0)}% for W${slot.week} ${slot.day} ${context.timeBucket}`;
  
  return { score: prob, reason };
}

export function trainFromExistingPlans(plans: Plan[]): { trained: number; events: number } {
  let totalEvents = 0;
  
  for (const plan of plans) {
    if (plan.blocks.length > 0) {
      trainFromBlocks(plan.blocks, plan.settings.name);
      totalEvents += plan.blocks.filter(b => b.templateId).length;
    }
  }
  
  const stats = getProbabilityTableStats(loadProbabilityTable());
  return { trained: plans.length, events: stats.totalEvents };
}

function createPlaceholderTemplate(bucket: typeof GOLDEN_RULE_BUCKETS[number]): BlockTemplate {
  return {
    id: `placeholder_${bucket.id}`,
    title: bucket.label,
    category: 'PD',
    colorHex: '#6366f1',
    defaultDurationMinutes: 60,
    countsTowardGoldenRule: true,
    goldenRuleBucketId: bucket.id,
    defaultLocation: '',
    defaultNotes: '',
  };
}

function calculateBucketDeficits(
  plan: Plan,
  templates: BlockTemplate[],
  targetWeeks: number[]
): { bucketId: GoldenRuleBucketId; label: string; deficit: number; perWeek: number }[] {
  const totals = calculateGoldenRuleTotals(plan, templates);
  const deficits: { bucketId: GoldenRuleBucketId; label: string; deficit: number; perWeek: number }[] = [];
  
  for (const total of totals) {
    if (total.difference < -15) {
      const deficit = Math.abs(total.difference);
      deficits.push({
        bucketId: total.id,
        label: total.label,
        deficit,
        perWeek: Math.ceil(deficit / targetWeeks.length),
      });
    }
  }
  
  return deficits.sort((a, b) => b.deficit - a.deficit);
}

function placeBlockInSlot(
  slot: TimeSlot,
  duration: number,
  template: BlockTemplate,
  bucketId: GoldenRuleBucketId,
  bucketLabel: string
): SuggestedBlock | null {
  const availableDuration = slot.endMinutes - slot.startMinutes;
  if (availableDuration < 15) return null;
  
  const blockDuration = Math.min(duration, availableDuration);
  const roundedDuration = Math.floor(blockDuration / 15) * 15;
  if (roundedDuration < 15) return null;
  
  return {
    id: uuidv4(),
    templateId: template.id,
    week: slot.week,
    day: slot.day,
    startMinutes: slot.startMinutes,
    durationMinutes: roundedDuration,
    titleOverride: '',
    location: template.defaultLocation || '',
    notes: '',
    countsTowardGoldenRule: true,
    goldenRuleBucketId: bucketId,
    recurrenceSeriesId: null,
    isRecurrenceException: false,
    resource: template.defaultResource,
    isLocked: false,
    isNew: true,
    bucketLabel,
    confidence: 0.5,
    reason: '',
  };
}

function placeBlockInSlotWithProbability(
  slot: TimeSlot,
  duration: number,
  template: BlockTemplate,
  bucketId: GoldenRuleBucketId,
  bucketLabel: string,
  templates: BlockTemplate[]
): SuggestedBlock | null {
  const block = placeBlockInSlot(slot, duration, template, bucketId, bucketLabel);
  if (!block) return null;
  
  const { score, reason } = scoreSlotForTemplate(slot, template, templates);
  block.confidence = score;
  block.reason = reason;
  
  return block;
}

export function generateScheduleSuggestions(
  plan: Plan,
  templates: BlockTemplate[],
  config: Partial<SchedulerConfig> = {}
): SchedulerResult {
  const cfg: SchedulerConfig = { ...DEFAULT_CONFIG, ...config };
  const suggestions: SuggestedBlock[] = [];
  const conflicts: string[] = [];
  
  const targetWeeks = cfg.distributeAcrossWeeks 
    ? Array.from({ length: cfg.totalWeeks }, (_, i) => i + 1)
    : [cfg.targetWeek];
  
  const deficits = calculateBucketDeficits(plan, templates, targetWeeks);
  
  const workingPlan = { ...plan, blocks: [...plan.blocks] };
  
  for (const deficit of deficits) {
    let remainingMinutes = deficit.deficit;
    const template = findTemplateForBucket(deficit.bucketId, templates) 
      || createPlaceholderTemplate(GOLDEN_RULE_BUCKETS.find(b => b.id === deficit.bucketId)!);
    
    const preferredDuration = template.defaultDurationMinutes || cfg.preferredBlockDuration;
    
    for (const week of targetWeeks) {
      if (remainingMinutes <= 0) break;
      
      const targetForWeek = Math.min(remainingMinutes, deficit.perWeek);
      let weekMinutes = 0;
      
      const slots = getAvailableSlots(workingPlan, week, cfg);
      
      for (const slot of slots) {
        if (weekMinutes >= targetForWeek) break;
        if (remainingMinutes <= 0) break;
        
        const slotDuration = slot.endMinutes - slot.startMinutes;
        if (slotDuration < 15) continue;
        
        const blockDuration = Math.min(
          preferredDuration,
          slotDuration,
          remainingMinutes
        );
        
        const suggestion = placeBlockInSlotWithProbability(
          slot,
          blockDuration,
          template,
          deficit.bucketId,
          deficit.label,
          templates
        );
        
        if (suggestion) {
          suggestions.push(suggestion);
          workingPlan.blocks.push(suggestion);
          remainingMinutes -= suggestion.durationMinutes;
          weekMinutes += suggestion.durationMinutes;
          
          slot.startMinutes += suggestion.durationMinutes;
        }
      }
    }
    
    if (remainingMinutes > 0) {
      conflicts.push(`Could not fully schedule ${deficit.label}: ${remainingMinutes} minutes remaining`);
    }
  }
  
  const coverage = GOLDEN_RULE_BUCKETS.map(bucket => {
    const existingTotals = calculateGoldenRuleTotals(plan, templates);
    const existing = existingTotals.find(t => t.id === bucket.id);
    const scheduled = existing?.scheduled || 0;
    const suggested = suggestions
      .filter(s => s.goldenRuleBucketId === bucket.id)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    
    return {
      bucketId: bucket.id,
      label: bucket.label,
      needed: bucket.budgetMinutes,
      scheduled: scheduled + suggested,
      gap: bucket.budgetMinutes - (scheduled + suggested),
    };
  });
  
  const totalMinutes = suggestions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalSlots = cfg.totalWeeks * DAYS.length * ((cfg.dayEndMinutes - cfg.dayStartMinutes) / cfg.slotMinutes);
  const filledSlots = suggestions.reduce((sum, s) => sum + (s.durationMinutes / cfg.slotMinutes), 0);
  
  return {
    suggestions,
    coverage,
    conflicts,
    stats: {
      totalBlocks: suggestions.length,
      totalMinutes,
      filledSlots: Math.round(filledSlots),
      emptySlots: Math.round(totalSlots - filledSlots),
    },
  };
}

export function generateWeekSuggestions(
  plan: Plan,
  templates: BlockTemplate[],
  week: number,
  settings: PlanSettings
): SchedulerResult {
  return generateScheduleSuggestions(plan, templates, {
    targetWeek: week,
    totalWeeks: settings.weeks,
    dayStartMinutes: settings.dayStartMinutes,
    dayEndMinutes: settings.dayEndMinutes,
    slotMinutes: settings.slotMinutes,
    distributeAcrossWeeks: false,
  });
}
