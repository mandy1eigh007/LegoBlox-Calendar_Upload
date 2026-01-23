import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data', 'predictive');
const SEED_PATH = path.resolve(process.cwd(), 'predictive', 'seed', 'training-calendars.generated.json');
const FALLBACK_SEED_PATH = path.resolve(process.cwd(), 'predictive', 'training-calendars.json');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
type Day = typeof DAYS[number];

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
    location?: string;
    description?: string;
    templateId?: string;
  }>;
};

export type TrainingEvent = {
  templateId: string | null;
  weekIndex: number;
  dayOfWeek: Day;
  startMinutes: number;
  durationMinutes: number;
  source?: string;
  title?: string;
};

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

const TIME_BUCKETS = ['early_morning', 'morning', 'midday', 'afternoon', 'late_afternoon'] as const;
type TimeBucket = typeof TIME_BUCKETS[number];

function minutesToTimeBucket(startMinutes: number): TimeBucket {
  if (startMinutes < 450) return 'early_morning';
  if (startMinutes < 570) return 'morning';
  if (startMinutes < 690) return 'midday';
  if (startMinutes < 810) return 'afternoon';
  return 'late_afternoon';
}

function contextKeyToString(weekIndex: number, dayOfWeek: Day, timeBucket: TimeBucket) {
  return `w${weekIndex}_${dayOfWeek}_${timeBucket}`;
}

function sanitizePlanId(planId: string) {
  return planId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function trainingFilePath(planId: string) {
  return path.join(DATA_DIR, `training_${sanitizePlanId(planId)}.json`);
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function existsTraining(planId: string) {
  const filePath = trainingFilePath(planId);
  return existsSync(filePath);
}

export async function getTraining(planId: string): Promise<TrainingPayload | null> {
  const filePath = trainingFilePath(planId);
  if (!existsSync(filePath)) return null;
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as TrainingPayload;
}

export async function saveTraining(planId: string, payload: TrainingPayload): Promise<void> {
  await ensureDir();
  const filePath = trainingFilePath(planId);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
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

function parseSeedEvents(calendars: SeedCalendar[]): TrainingEvent[] {
  const events: TrainingEvent[] = [];

  for (const calendar of calendars) {
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

function buildProbabilityTable(events: TrainingEvent[]): SerializedProbabilityTable {
  const entries: Record<string, Record<string, number>> = {};
  const totalsByContext: Record<string, number> = {};
  const templateCounts: Record<string, number> = {};
  let totalEvents = 0;

  for (const event of events) {
    if (!event.templateId) continue;
    const timeBucket = minutesToTimeBucket(event.startMinutes);
    const ctxKey = contextKeyToString(event.weekIndex, event.dayOfWeek, timeBucket);

    if (!entries[ctxKey]) entries[ctxKey] = {};
    entries[ctxKey][event.templateId] = (entries[ctxKey][event.templateId] || 0) + 1;
    totalsByContext[ctxKey] = (totalsByContext[ctxKey] || 0) + 1;
    templateCounts[event.templateId] = (templateCounts[event.templateId] || 0) + 1;
    totalEvents += 1;
  }

  const trainedFrom = Array.from(
    new Set(events.map(event => event.source).filter((source): source is string => !!source))
  );

  return {
    entries,
    totalsByContext,
    templateCounts,
    totalEvents,
    version: 1,
    trainedFrom,
  };
}

export async function initializeTraining(planId: string): Promise<TrainingPayload> {
  let calendars: SeedCalendar[] = [];
  const seedPath = existsSync(SEED_PATH) ? SEED_PATH : FALLBACK_SEED_PATH;
  if (existsSync(seedPath)) {
    const raw = await fs.readFile(seedPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.calendars && Array.isArray(parsed.calendars)) {
      calendars = parsed.calendars as SeedCalendar[];
    }
  }

  const events = parseSeedEvents(calendars);
  const probabilityTable = buildProbabilityTable(events);
  const payload = { probabilityTable, events };
  await saveTraining(planId, payload);
  return payload;
}
