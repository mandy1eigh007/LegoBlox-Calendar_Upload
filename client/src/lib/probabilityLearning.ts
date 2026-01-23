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

export interface TrainingEvent {
  templateId: string | null;
  weekIndex: number;
  dayOfWeek: Day;
  startMinutes: number;
  durationMinutes: number;
  source?: string;
  title?: string;
}

export type SerializedProbabilityTable = {
  entries: Record<string, Record<string, number>>;
  totalsByContext: Record<string, number>;
  templateCounts: Record<string, number>;
  totalEvents: number;
  version: number;
  trainedFrom: string[];
};

export type TrainingPayload = {
  probabilityTable: SerializedProbabilityTable;
  events: TrainingEvent[];
};

type SeedCalendar = {
  name: string;
  programWeeks?: number;
  daysOfWeek?: string[];
  dayStart?: string;
  dayEnd?: string;
  events: Array<{
    title: string;
    start: string;
    end: string;
    location?: string | null;
    description?: string | null;
    templateId?: string;
  }>;
};

const STORAGE_KEY = 'cohort-schedule-probability-table';
const TRAINING_CACHE_PREFIX = 'cohort-schedule-training-cache';
const ALPHA = 1;

function getStorageKey(planId?: string) {
  return planId ? `${STORAGE_KEY}:${planId}` : STORAGE_KEY;
}

function getTrainingCacheKey(planId: string) {
  return `${TRAINING_CACHE_PREFIX}:${planId}`;
}

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

export function serializeProbabilityTable(table: ProbabilityTable): SerializedProbabilityTable {
  return {
    entries: Object.fromEntries(
      Array.from(table.entries.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
    ),
    totalsByContext: Object.fromEntries(table.totalsByContext),
    templateCounts: Object.fromEntries(table.templateCounts),
    totalEvents: table.totalEvents,
    version: table.version,
    trainedFrom: table.trainedFrom,
  };
}

export function deserializeProbabilityTable(data?: SerializedProbabilityTable | null): ProbabilityTable {
  if (!data) return createEmptyProbabilityTable();
  return {
    entries: new Map(Object.entries(data.entries || {}).map(([k, v]) => [k, new Map(Object.entries(v as Record<string, number>))])),
    totalsByContext: new Map(Object.entries(data.totalsByContext || {})),
    templateCounts: new Map(Object.entries(data.templateCounts || {})),
    totalEvents: data.totalEvents || 0,
    version: data.version || 1,
    trainedFrom: data.trainedFrom || [],
  };
}

function loadProbabilityTableSync(planId?: string): ProbabilityTable {
  try {
    const stored = localStorage.getItem(getStorageKey(planId));
    if (stored) {
      const parsed = JSON.parse(stored);
      return deserializeProbabilityTable(parsed);
    }
  } catch {
    console.warn('Failed to load probability table');
  }
  return createEmptyProbabilityTable();
}

function loadTrainingCache(planId: string): TrainingPayload | null {
  try {
    const cached = localStorage.getItem(getTrainingCacheKey(planId));
    if (!cached) return null;
    return JSON.parse(cached) as TrainingPayload;
  } catch {
    return null;
  }
}

function saveTrainingCache(planId: string, payload: TrainingPayload): void {
  try {
    localStorage.setItem(getTrainingCacheKey(planId), JSON.stringify(payload));
  } catch {
    // ignore cache failures
  }
}

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayFromIndex(idx: number): Day | null {
  if (idx < 0 || idx > 4) return null;
  return DAYS[idx] || null;
}

function convertSeedCalendarsToEvents(seed: { calendars?: SeedCalendar[] }): TrainingEvent[] {
  if (!seed || !Array.isArray(seed.calendars)) return [];
  const events: TrainingEvent[] = [];

  for (const calendar of seed.calendars) {
    if (!calendar.events || calendar.events.length === 0) continue;
    const sorted = [...calendar.events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const minDate = new Date(sorted[0].start);
    const mondayRef = getMonday(minDate);

    for (const event of calendar.events) {
      if (!event.start || !event.end) continue;
      const start = new Date(event.start);
      const end = new Date(event.end);
      const startDateOnly = new Date(start);
      startDateOnly.setHours(0, 0, 0, 0);

      const diffDays = Math.floor((startDateOnly.getTime() - mondayRef.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) continue;
      const weekIndex = Math.floor(diffDays / 7) + 1;
      const dayIndex = diffDays % 7;
      const dayOfWeek = getDayFromIndex(dayIndex);
      if (!dayOfWeek) continue;

      const useUTC = event.start.endsWith('Z');
      const startHour = useUTC ? start.getUTCHours() : start.getHours();
      const startMinute = useUTC ? start.getUTCMinutes() : start.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / (1000 * 60) / 15) * 15);
      const templateId = (event.templateId || event.title || '').trim() || null;

      events.push({
        templateId,
        weekIndex,
        dayOfWeek,
        startMinutes,
        durationMinutes,
        source: 'seed',
        title: event.title,
      });
    }
  }

  return events;
}

export async function fetchSeedCalendars(): Promise<TrainingEvent[]> {
  try {
    const res = await fetch('/api/predictive/seed-calendars');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    return convertSeedCalendarsToEvents(payload);
  } catch {
    return [];
  }
}

export async function fetchTraining(planId: string): Promise<TrainingPayload | null> {
  try {
    const res = await fetch(`/api/predictive/training/${planId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (!payload || typeof payload !== 'object') throw new Error('Invalid training payload');
    if (!payload.probabilityTable && Array.isArray(payload.events)) {
      const table = buildProbabilityTableFromEvents(payload.events);
      const normalized = { probabilityTable: serializeProbabilityTable(table), events: payload.events };
      saveTrainingCache(planId, normalized);
      return normalized;
    }
    saveTrainingCache(planId, payload as TrainingPayload);
    return payload as TrainingPayload;
  } catch {
    return loadTrainingCache(planId);
  }
}

export async function persistTraining(planId: string, payload: TrainingPayload): Promise<boolean> {
  try {
    const res = await fetch(`/api/predictive/training/${planId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    saveTrainingCache(planId, payload);
    return true;
  } catch {
    saveTrainingCache(planId, payload);
    return false;
  }
}

export async function loadProbabilityTable(planId?: string): Promise<ProbabilityTable> {
  if (!planId) return loadProbabilityTableSync();
  const payload = await fetchTraining(planId);
  if (payload?.probabilityTable) {
    return deserializeProbabilityTable(payload.probabilityTable);
  }
  return loadProbabilityTableSync(planId);
}

export function saveProbabilityTable(table: ProbabilityTable, planId?: string, events: TrainingEvent[] = []): void {
  const serializable = serializeProbabilityTable(table);
  localStorage.setItem(getStorageKey(planId), JSON.stringify(serializable));
  if (planId) {
    const payload = { probabilityTable: serializable, events };
    saveTrainingCache(planId, payload);
    void persistTraining(planId, payload);
  }
}

export function trainFromBlocks(
  blocks: PlacedBlock[],
  sourceName: string,
  existingTable?: ProbabilityTable
): ProbabilityTable {
  const table = existingTable || loadProbabilityTableSync();
  
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

export function buildProbabilityTableFromEvents(
  events: TrainingEvent[],
  existingTable?: ProbabilityTable
): ProbabilityTable {
  const table = existingTable || createEmptyProbabilityTable();

  for (const event of events) {
    if (!event.templateId) continue;
    const ctx: ContextKey = {
      weekIndex: event.weekIndex,
      dayOfWeek: event.dayOfWeek,
      timeBucket: minutesToTimeBucket(event.startMinutes),
    };
    const ctxKey = contextKeyToString(ctx);
    if (!table.entries.has(ctxKey)) {
      table.entries.set(ctxKey, new Map());
    }
    const ctxEntries = table.entries.get(ctxKey)!;
    ctxEntries.set(event.templateId, (ctxEntries.get(event.templateId) || 0) + 1);
    table.totalsByContext.set(ctxKey, (table.totalsByContext.get(ctxKey) || 0) + 1);
    table.templateCounts.set(event.templateId, (table.templateCounts.get(event.templateId) || 0) + 1);
    table.totalEvents++;
  }

  table.trainedFrom = Array.from(
    new Set(events.map(event => event.source).filter((source): source is string => !!source))
  );

  return table;
}

export async function persistTrainingEvents(planId: string, newEvents: TrainingEvent[]): Promise<TrainingPayload | null> {
  const existing = await fetchTraining(planId);
  const combinedEvents = [...(existing?.events || []), ...newEvents];
  const table = buildProbabilityTableFromEvents(combinedEvents);
  const payload = { probabilityTable: serializeProbabilityTable(table), events: combinedEvents };
  await persistTraining(planId, payload);
  return payload;
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
