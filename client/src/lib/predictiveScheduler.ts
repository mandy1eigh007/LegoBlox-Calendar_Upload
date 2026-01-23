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
  TrainingExample,
} from '@/state/types';
import { calculateGoldenRuleTotals } from './goldenRule';
import { loadProbabilityTable, minutesToTimeBucket, TimeBucket, trainFromBlocks, getProbabilityTableStats } from './probabilityLearning';

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
  activeDays?: Day[];
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
const TIME_BUCKETS: TimeBucket[] = ['early_morning', 'morning', 'midday', 'afternoon', 'late_afternoon'];

type TemplateTrainingPrior = {
  total: number;
  weekCounts: Map<number, number>;
  dayCounts: Record<Day, number>;
  timeCounts: Record<TimeBucket, number>;
};

function buildEmptyDayCounts(): Record<Day, number> {
  const counts = {} as Record<Day, number>;
  for (const day of DAYS) {
    counts[day] = 0;
  }
  return counts;
}

function buildEmptyTimeCounts(): Record<TimeBucket, number> {
  const counts = {} as Record<TimeBucket, number>;
  for (const bucket of TIME_BUCKETS) {
    counts[bucket] = 0;
  }
  return counts;
}

function buildTrainingPriors(examples: TrainingExample[]): Map<string, TemplateTrainingPrior> {
  const priors = new Map<string, TemplateTrainingPrior>();
  for (const example of examples) {
    if (!priors.has(example.templateId)) {
      priors.set(example.templateId, {
        total: 0,
        weekCounts: new Map(),
        dayCounts: buildEmptyDayCounts(),
        timeCounts: buildEmptyTimeCounts(),
      });
    }
    const prior = priors.get(example.templateId)!;
    prior.total += 1;
    prior.weekCounts.set(example.weekIndex, (prior.weekCounts.get(example.weekIndex) || 0) + 1);
    prior.dayCounts[example.dayOfWeek] += 1;
    const bucket = minutesToTimeBucket(example.startMinutes);
    prior.timeCounts[bucket] += 1;
  }
  return priors;
}

function getWeekWeight(prior: TemplateTrainingPrior, week: number): number {
  return (prior.weekCounts.get(week) || 0) + 1;
}

function getAvailableSlots(
  plan: Plan,
  week: number,
  config: SchedulerConfig
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const existingBlocks = plan.blocks.filter(b => b.week === week);
  const hardDates = config.hardDates || [];
  const activeDays = config.activeDays && config.activeDays.length > 0 ? config.activeDays : DAYS;
  
  for (const day of activeDays) {
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
  trainingPriors: Map<string, TemplateTrainingPrior>,
  totalWeeks: number,
  hasTraining: boolean
): { score: number; reason: string } {
  const prior = trainingPriors.get(template.id);
  const timeBucket = minutesToTimeBucket(slot.startMinutes);

  if (prior) {
    const weekScore = (prior.weekCounts.get(slot.week) || 0) + 1;
    const dayScore = prior.dayCounts[slot.day] + 1;
    const timeScore = prior.timeCounts[timeBucket] + 1;
    const score =
      (weekScore / (prior.total + totalWeeks)) *
      (dayScore / (prior.total + DAYS.length)) *
      (timeScore / (prior.total + TIME_BUCKETS.length));
    return {
      score,
      reason: `Trained prior: W${slot.week} ${slot.day} ${timeBucket}`,
    };
  }

  if (hasTraining) {
    return { score: 0.25, reason: 'No training history for template; heuristic placement' };
  }

  return { score: 0.25, reason: 'No training match. Using budget-only heuristic.' };
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
    if (total.isFlexible) continue;
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
  score: number,
  reason: string
): SuggestedBlock | null {
  const block = placeBlockInSlot(slot, duration, template, bucketId, bucketLabel);
  if (!block) return null;

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
  const trainingExamples = plan.trainingExamples || [];
  const trainingPriors = buildTrainingPriors(trainingExamples);
  const hasTraining = trainingPriors.size > 0;
  
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
    const templatePrior = trainingPriors.get(template.id);
    const orderedWeeks = templatePrior
      ? [...targetWeeks].sort((a, b) => getWeekWeight(templatePrior, b) - getWeekWeight(templatePrior, a))
      : targetWeeks;
    const totalWeekWeight = templatePrior
      ? orderedWeeks.reduce((sum, week) => sum + getWeekWeight(templatePrior, week), 0)
      : 0;

    for (const week of orderedWeeks) {
      if (remainingMinutes <= 0) break;
      
      let targetForWeek = Math.min(remainingMinutes, deficit.perWeek);
      if (templatePrior && totalWeekWeight > 0) {
        const weekWeight = getWeekWeight(templatePrior, week);
        const weightedTarget = Math.round(deficit.deficit * (weekWeight / totalWeekWeight));
        targetForWeek = weightedTarget > 0
          ? Math.min(remainingMinutes, Math.max(cfg.slotMinutes, weightedTarget))
          : 0;
      }
      if (targetForWeek <= 0) continue;
      let weekMinutes = 0;
      
      const slots = getAvailableSlots(workingPlan, week, cfg);
      const scoredSlots = slots.map((slot, idx) => {
        const { score, reason } = scoreSlotForTemplate(
          slot,
          template,
          trainingPriors,
          cfg.totalWeeks,
          hasTraining
        );
        return { slot, score, reason, idx };
      }).sort((a, b) => (b.score - a.score) || (a.idx - b.idx));

      for (const { slot, score, reason } of scoredSlots) {
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
          score,
          reason
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
    const isFlexible = !!existing?.isFlexible;
    const adjustedBudget = existing?.budget ?? bucket.budgetMinutes;
    const suggested = suggestions
      .filter(s => s.goldenRuleBucketId === bucket.id)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const effectiveBudget = isFlexible ? scheduled + suggested : adjustedBudget;
    
    return {
      bucketId: bucket.id,
      label: bucket.label,
      needed: effectiveBudget,
      scheduled: scheduled + suggested,
      gap: isFlexible ? 0 : adjustedBudget - (scheduled + suggested),
    };
  });
  
  const totalMinutes = suggestions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const activeDays = cfg.activeDays && cfg.activeDays.length > 0 ? cfg.activeDays : DAYS;
  const totalSlots = cfg.totalWeeks * activeDays.length * ((cfg.dayEndMinutes - cfg.dayStartMinutes) / cfg.slotMinutes);
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
    activeDays: settings.activeDays,
  });
}
