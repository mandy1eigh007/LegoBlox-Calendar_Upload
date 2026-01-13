import { PlacedBlock, BlockTemplate, Day, DAYS } from '@/state/types';
import { GOLDEN_RULE_BUCKETS, GoldenRuleBucketId } from '@/state/types';

export type TimeBucket = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'late_afternoon';

export interface ContextKey {
  weekIndex: number;
  dayOfWeek: Day;
  timeBucket: TimeBucket;
}

export interface ProbabilityEntry {
  templateId: string;
  count: number;
  probability: number;
}

export interface ProbabilityTable {
  entries: Map<string, Map<string, number>>;
  totalsByContext: Map<string, number>;
  templateCounts: Map<string, number>;
  totalEvents: number;
  version: number;
  trainedFrom: string[];
}

const STORAGE_KEY = 'cohort-schedule-probability-table';
const ALPHA = 1;

export function minutesToTimeBucket(startMinutes: number): TimeBucket {
  if (startMinutes < 450) return 'early_morning';
  if (startMinutes < 570) return 'morning';
  if (startMinutes < 690) return 'midday';
  if (startMinutes < 810) return 'afternoon';
  return 'late_afternoon';
}

export function contextKeyToString(ctx: ContextKey): string {
  return `w${ctx.weekIndex}_${ctx.dayOfWeek}_${ctx.timeBucket}`;
}

export function createEmptyProbabilityTable(): ProbabilityTable {
  return {
    entries: new Map(),
    totalsByContext: new Map(),
    templateCounts: new Map(),
    totalEvents: 0,
    version: 1,
    trainedFrom: [],
  };
}

export function loadProbabilityTable(): ProbabilityTable {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        entries: new Map(Object.entries(parsed.entries || {}).map(([k, v]) => [k, new Map(Object.entries(v as Record<string, number>))])),
        totalsByContext: new Map(Object.entries(parsed.totalsByContext || {})),
        templateCounts: new Map(Object.entries(parsed.templateCounts || {})),
        totalEvents: parsed.totalEvents || 0,
        version: parsed.version || 1,
        trainedFrom: parsed.trainedFrom || [],
      };
    }
  } catch {
    console.warn('Failed to load probability table');
  }
  return createEmptyProbabilityTable();
}

export function saveProbabilityTable(table: ProbabilityTable): void {
  const serializable = {
    entries: Object.fromEntries(
      Array.from(table.entries.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
    ),
    totalsByContext: Object.fromEntries(table.totalsByContext),
    templateCounts: Object.fromEntries(table.templateCounts),
    totalEvents: table.totalEvents,
    version: table.version,
    trainedFrom: table.trainedFrom,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export function trainFromBlocks(
  blocks: PlacedBlock[],
  sourceName: string,
  existingTable?: ProbabilityTable
): ProbabilityTable {
  const table = existingTable || loadProbabilityTable();
  
  for (const block of blocks) {
    if (!block.templateId) continue;
    
    const ctx: ContextKey = {
      weekIndex: block.week,
      dayOfWeek: block.day,
      timeBucket: minutesToTimeBucket(block.startMinutes),
    };
    
    const ctxKey = contextKeyToString(ctx);
    
    if (!table.entries.has(ctxKey)) {
      table.entries.set(ctxKey, new Map());
    }
    
    const ctxEntries = table.entries.get(ctxKey)!;
    ctxEntries.set(block.templateId, (ctxEntries.get(block.templateId) || 0) + 1);
    
    table.totalsByContext.set(ctxKey, (table.totalsByContext.get(ctxKey) || 0) + 1);
    table.templateCounts.set(block.templateId, (table.templateCounts.get(block.templateId) || 0) + 1);
    table.totalEvents++;
  }
  
  if (!table.trainedFrom.includes(sourceName)) {
    table.trainedFrom.push(sourceName);
  }
  
  saveProbabilityTable(table);
  return table;
}

export function getProbability(
  table: ProbabilityTable,
  templateId: string,
  context: ContextKey,
  numTemplates: number
): number {
  const ctxKey = contextKeyToString(context);
  const ctxEntries = table.entries.get(ctxKey);
  
  const count = ctxEntries?.get(templateId) || 0;
  const total = table.totalsByContext.get(ctxKey) || 0;
  
  return (count + ALPHA) / (total + ALPHA * numTemplates);
}

export function getTopTemplatesForContext(
  table: ProbabilityTable,
  context: ContextKey,
  templates: BlockTemplate[],
  limit: number = 5
): { templateId: string; probability: number; title: string }[] {
  const results: { templateId: string; probability: number; title: string }[] = [];
  
  for (const template of templates) {
    const prob = getProbability(table, template.id, context, templates.length);
    results.push({
      templateId: template.id,
      probability: prob,
      title: template.title,
    });
  }
  
  results.sort((a, b) => b.probability - a.probability);
  return results.slice(0, limit);
}

export function getTemplateFrequencyByWeek(
  table: ProbabilityTable,
  templateId: string,
  weeks: number = 9
): number[] {
  const weekCounts: number[] = new Array(weeks).fill(0);
  
  Array.from(table.entries.entries()).forEach(([ctxKey, entries]) => {
    const match = ctxKey.match(/^w(\d+)_/);
    if (match) {
      const weekIdx = parseInt(match[1], 10);
      if (weekIdx >= 1 && weekIdx <= weeks) {
        weekCounts[weekIdx - 1] += entries.get(templateId) || 0;
      }
    }
  });
  
  return weekCounts;
}

export function getTemplateFrequencyByDay(
  table: ProbabilityTable,
  templateId: string
): Record<Day, number> {
  const dayCounts: Record<Day, number> = {} as Record<Day, number>;
  for (const day of DAYS) {
    dayCounts[day] = 0;
  }
  
  Array.from(table.entries.entries()).forEach(([ctxKey, entries]) => {
    for (const day of DAYS) {
      if (ctxKey.includes(`_${day}_`)) {
        dayCounts[day] += entries.get(templateId) || 0;
      }
    }
  });
  
  return dayCounts;
}

export function getTemplateFrequencyByTimeBucket(
  table: ProbabilityTable,
  templateId: string
): Record<TimeBucket, number> {
  const timeBuckets: TimeBucket[] = ['early_morning', 'morning', 'midday', 'afternoon', 'late_afternoon'];
  const bucketCounts: Record<TimeBucket, number> = {} as Record<TimeBucket, number>;
  
  for (const bucket of timeBuckets) {
    bucketCounts[bucket] = 0;
  }
  
  Array.from(table.entries.entries()).forEach(([ctxKey, entries]) => {
    for (const bucket of timeBuckets) {
      if (ctxKey.endsWith(`_${bucket}`)) {
        bucketCounts[bucket] += entries.get(templateId) || 0;
      }
    }
  });
  
  return bucketCounts;
}

export function clearProbabilityTable(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getProbabilityTableStats(table: ProbabilityTable): {
  totalEvents: number;
  uniqueTemplates: number;
  uniqueContexts: number;
  trainedFrom: string[];
} {
  return {
    totalEvents: table.totalEvents,
    uniqueTemplates: table.templateCounts.size,
    uniqueContexts: table.entries.size,
    trainedFrom: table.trainedFrom,
  };
}
