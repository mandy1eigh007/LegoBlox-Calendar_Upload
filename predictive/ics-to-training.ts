import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

type TrainingCalendar = {
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

type ParsedICSEvent = {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  description?: string;
  originalTimezone?: string;
  isUTC?: boolean;
  rrule?: string;
  recurrenceId?: Date;
  exdates?: Date[];
  status?: string;
  isDateOnly?: boolean;
};

type ParsedRRule = {
  freq: string;
  interval: number;
  byDay: string[];
  count?: number;
  until?: Date;
};

const DEFAULT_DAY_START = '06:30';
const DEFAULT_DAY_END = '15:30';
const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DEFAULT_OUTPUT = path.join(process.cwd(), 'predictive', 'training-calendars.json');
const DEFAULT_SYNONYMS = path.join(process.cwd(), 'predictive', 'template-synonyms.json');

const SKIP_TITLE_PATTERNS = [
  /\bweek\s+\d+\b/i,
  /hold for transit/i,
  /\btravel\b/i,
  /^lunch\b/i,
  /\bua\b/i,
  /^eli out\b/i,
];

const RRULE_DAY_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseHM(hm: string) {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseICSDate(dateStr: string, tzid?: string): { date: Date | null; isUTC: boolean; tzid?: string; isDateOnly: boolean } {
  if (!dateStr) return { date: null, isUTC: false, isDateOnly: false };

  const cleanStr = dateStr.replace(/[^0-9TZ]/g, '');
  const isDateOnly = cleanStr.length === 8;

  if (cleanStr.endsWith('Z')) {
    const year = parseInt(cleanStr.slice(0, 4));
    const month = parseInt(cleanStr.slice(4, 6)) - 1;
    const day = parseInt(cleanStr.slice(6, 8));
    const hour = parseInt(cleanStr.slice(9, 11)) || 0;
    const minute = parseInt(cleanStr.slice(11, 13)) || 0;
    return { date: new Date(Date.UTC(year, month, day, hour, minute)), isUTC: true, tzid: 'UTC', isDateOnly };
  }

  const year = parseInt(cleanStr.slice(0, 4));
  const month = parseInt(cleanStr.slice(4, 6)) - 1;
  const day = parseInt(cleanStr.slice(6, 8));
  const hour = parseInt(cleanStr.slice(9, 11)) || 0;
  const minute = parseInt(cleanStr.slice(11, 13)) || 0;

  return { date: new Date(year, month, day, hour, minute), isUTC: false, tzid, isDateOnly };
}

function parseRRule(rrule: string): ParsedRRule | null {
  const parts = rrule.split(';');
  const data: ParsedRRule = {
    freq: '',
    interval: 1,
    byDay: [],
  };
  for (const part of parts) {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey || !rawValue) continue;
    const key = rawKey.toUpperCase();
    const value = rawValue.toUpperCase();
    if (key === 'FREQ') data.freq = value;
    if (key === 'INTERVAL') data.interval = Math.max(1, parseInt(value, 10) || 1);
    if (key === 'COUNT') data.count = Math.max(1, parseInt(value, 10) || 0);
    if (key === 'BYDAY') {
      data.byDay = value.split(',').map(v => v.trim()).filter(Boolean);
    }
    if (key === 'UNTIL') {
      const parsed = parseICSDate(value);
      if (parsed.date) data.until = parsed.date;
    }
  }
  if (!data.freq) return null;
  return data;
}

function getWeekStartMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDayOffsetFromMonday(dayToken: string): number | null {
  const idx = RRULE_DAY_TO_INDEX[dayToken];
  if (idx === undefined) return null;
  return idx === 0 ? 6 : idx - 1;
}

function expandRecurringEvents(events: ParsedICSEvent[]): ParsedICSEvent[] {
  const exceptions = new Map<string, ParsedICSEvent>();
  const exceptionKeys = new Set<string>();
  const exceptionEvents = events.filter(e => e.recurrenceId && e.uid);
  for (const ex of exceptionEvents) {
    const key = `${ex.uid}-${ex.recurrenceId!.getTime()}`;
    exceptions.set(key, ex);
    exceptionKeys.add(key);
  }

  const expanded: ParsedICSEvent[] = [];
  const nonRecurring = events.filter(e => !e.rrule || e.recurrenceId);
  for (const e of nonRecurring) {
    if (e.status && e.status.toUpperCase() === 'CANCELLED') continue;
    expanded.push(e);
  }

  const recurringBases = events.filter(e => e.rrule && !e.recurrenceId);
  const MAX_OCCURRENCES = 2000;

  for (const base of recurringBases) {
    if (base.status && base.status.toUpperCase() === 'CANCELLED') continue;
    const parsed = base.rrule ? parseRRule(base.rrule) : null;
    if (!parsed || parsed.freq !== 'WEEKLY') {
      expanded.push(base);
      continue;
    }

    const byDays = parsed.byDay.length > 0 ? parsed.byDay : [RRULE_DAY_TO_INDEX[base.dtstart.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 2)]?.toString() || 'MO'];
    const interval = parsed.interval || 1;
    const countLimit = parsed.count ?? MAX_OCCURRENCES;
    const until = parsed.until;

    const baseStart = new Date(base.dtstart);
    const baseEnd = new Date(base.dtend);
    const baseDuration = baseEnd.getTime() - baseStart.getTime();

    const firstWeekStart = getWeekStartMonday(baseStart);
    let occurrences = 0;
    let weekOffset = 0;

    while (occurrences < countLimit && occurrences < MAX_OCCURRENCES) {
      const weekStart = new Date(firstWeekStart);
      weekStart.setDate(weekStart.getDate() + weekOffset * 7);

      for (const dayToken of byDays) {
        const offset = getDayOffsetFromMonday(dayToken);
        if (offset === null) continue;
        const occurrenceStart = new Date(weekStart);
        occurrenceStart.setDate(occurrenceStart.getDate() + offset);
        occurrenceStart.setHours(baseStart.getHours(), baseStart.getMinutes(), 0, 0);

        if (occurrenceStart < baseStart) continue;
        if (until && occurrenceStart > until) continue;

        const occurrenceEnd = new Date(occurrenceStart.getTime() + baseDuration);
        const key = `${base.uid}-${occurrenceStart.getTime()}`;
        if (exceptions.has(key)) {
          expanded.push(exceptions.get(key)!);
          exceptionKeys.add(key);
        } else {
          expanded.push({
            ...base,
            dtstart: occurrenceStart,
            dtend: occurrenceEnd,
          });
        }

        occurrences++;
        if (occurrences >= countLimit || occurrences >= MAX_OCCURRENCES) break;
      }

      weekOffset += interval;
      if (weekOffset >= Number.MAX_SAFE_INTEGER) break;
    }
  }

  for (const [key, ex] of Array.from(exceptions.entries())) {
    if (!exceptionKeys.has(key)) continue;
    if (ex.status && ex.status.toUpperCase() === 'CANCELLED') continue;
    expanded.push(ex);
  }

  return expanded;
}

function parseICS(content: string): { events: ParsedICSEvent[]; detectedTimezone: string | null; calendarName: string | null } {
  const events: ParsedICSEvent[] = [];
  const lines = content.replace(/\r\n /g, '').split(/\r?\n/);

  let inEvent = false;
  let currentEvent: Partial<ParsedICSEvent> & { startTzid?: string } = {};
  let detectedTimezone: string | null = null;
  let calendarName: string | null = null;

  for (const line of lines) {
    if (line.startsWith('X-WR-CALNAME:')) {
      calendarName = line.split(':')[1]?.trim() || calendarName;
    }

    if (line.startsWith('X-WR-TIMEZONE:') || line.startsWith('TZID:')) {
      const tz = line.split(':')[1]?.trim();
      if (tz && !detectedTimezone) detectedTimezone = tz;
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
        events.push({
          uid: currentEvent.uid || randomUUID(),
          summary: currentEvent.summary,
          dtstart: currentEvent.dtstart,
          dtend: currentEvent.dtend,
          location: currentEvent.location,
          description: currentEvent.description,
          originalTimezone: currentEvent.startTzid || detectedTimezone || undefined,
          isUTC: currentEvent.isUTC,
          rrule: currentEvent.rrule,
          recurrenceId: currentEvent.recurrenceId,
          exdates: currentEvent.exdates,
          status: currentEvent.status,
          isDateOnly: currentEvent.isDateOnly,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const keyPart = line.slice(0, colonIndex);
    const key = keyPart.split(';')[0];
    const value = line.slice(colonIndex + 1);
    const tzidMatch = keyPart.match(/TZID=([^;:]+)/);
    const tzid = tzidMatch ? tzidMatch[1] : undefined;
    const isDateOnly = keyPart.includes('VALUE=DATE');

    switch (key) {
      case 'UID':
        currentEvent.uid = value;
        break;
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'RRULE':
        currentEvent.rrule = value;
        break;
      case 'RECURRENCE-ID': {
        const parsed = parseICSDate(value, tzid);
        currentEvent.recurrenceId = parsed.date || undefined;
        break;
      }
      case 'EXDATE': {
        const values = value.split(',').map(v => v.trim()).filter(Boolean);
        const parsedDates = values
          .map(v => parseICSDate(v, tzid).date)
          .filter((d): d is Date => !!d);
        if (parsedDates.length > 0) {
          currentEvent.exdates = (currentEvent.exdates || []).concat(parsedDates);
        }
        break;
      }
      case 'DTSTART': {
        const parsed = parseICSDate(value, tzid);
        currentEvent.dtstart = parsed.date || undefined;
        currentEvent.isUTC = parsed.isUTC;
        currentEvent.startTzid = parsed.tzid || tzid;
        if (isDateOnly || parsed.isDateOnly) currentEvent.isDateOnly = true;
        break;
      }
      case 'DTEND': {
        const parsed = parseICSDate(value, tzid);
        currentEvent.dtend = parsed.date || undefined;
        if (isDateOnly || parsed.isDateOnly) currentEvent.isDateOnly = true;
        break;
      }
      case 'LOCATION':
        currentEvent.location = value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = value.replace(/\\n/g, '\n');
        break;
      case 'STATUS':
        currentEvent.status = value;
        break;
    }
  }

  return { events, detectedTimezone, calendarName };
}

function loadSynonyms(synonymsPath: string): Record<string, string[]> {
  if (!fs.existsSync(synonymsPath)) return {};
  const raw = fs.readFileSync(synonymsPath, 'utf8');
  return JSON.parse(raw) as Record<string, string[]>;
}

function mapTitleToTemplate(title: string, synonyms: Record<string, string[]>): string | null {
  const norm = normalizeText(title);
  if (!norm) return null;

  for (const canonical of Object.keys(synonyms)) {
    if (normalizeText(canonical) === norm) return canonical;
  }

  for (const [canonical, syns] of Object.entries(synonyms)) {
    for (const s of syns) {
      const n = normalizeText(s);
      if (n && norm.includes(n)) return canonical;
    }
  }

  for (const canonical of Object.keys(synonyms)) {
    const ncanon = normalizeText(canonical);
    if (ncanon && norm.includes(ncanon)) return canonical;
  }

  return null;
}

function shouldSkipTitle(title: string) {
  return SKIP_TITLE_PATTERNS.some(p => p.test(title));
}

function isAllDayEvent(event: ParsedICSEvent) {
  if (event.isDateOnly) return true;
  const duration = event.dtend.getTime() - event.dtstart.getTime();
  const startMinutes = event.dtstart.getHours() * 60 + event.dtstart.getMinutes();
  const endMinutes = event.dtend.getHours() * 60 + event.dtend.getMinutes();
  return startMinutes === 0 && endMinutes === 0 && duration >= 24 * 60 * 60 * 1000;
}

function withinScheduleHours(event: ParsedICSEvent, dayStart: string, dayEnd: string) {
  const startMinutes = event.dtstart.getHours() * 60 + event.dtstart.getMinutes();
  const endMinutes = event.dtend.getHours() * 60 + event.dtend.getMinutes();
  const startLimit = parseHM(dayStart);
  const endLimit = parseHM(dayEnd);
  return startMinutes >= startLimit && endMinutes <= endLimit;
}

function calculateProgramWeeks(events: ParsedICSEvent[]) {
  if (events.length === 0) return 9;
  const times = events.map(e => e.dtstart.getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const diffDays = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)));
  return Math.max(1, Math.round(diffDays / 7) + 1);
}

function collectICSFiles(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    if (!fs.existsSync(input)) continue;
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(input);
      for (const entry of entries) {
        if (entry.toLowerCase().endsWith('.ics')) {
          files.push(path.join(input, entry));
        }
      }
    } else if (stat.isFile() && input.toLowerCase().endsWith('.ics')) {
      files.push(input);
    }
  }
  return files;
}

function toISO(date: Date) {
  return date.toISOString();
}

function buildTrainingCalendars(
  icsFiles: string[],
  synonyms: Record<string, string[]>,
  dayStart = DEFAULT_DAY_START,
  dayEnd = DEFAULT_DAY_END,
  daysOfWeek = DEFAULT_DAYS
) {
  const calendars: TrainingCalendar[] = [];
  const unmatchedCounts = new Map<string, number>();
  let totalEvents = 0;
  let skippedEvents = 0;

  for (const file of icsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const { events: rawEvents, calendarName } = parseICS(content);
    const expanded = expandRecurringEvents(rawEvents);
    const filtered = expanded.filter(e => {
      if (!e.summary) return false;
      if (e.status && e.status.toUpperCase() === 'CANCELLED') return false;
      if (isAllDayEvent(e)) return false;
      if (shouldSkipTitle(e.summary)) return false;
      return true;
    });

    const programWeeks = calculateProgramWeeks(filtered);
    const trainingEvents: TrainingCalendar['events'] = [];

    for (const ev of filtered) {
      if (!withinScheduleHours(ev, dayStart, dayEnd)) {
        skippedEvents++;
        continue;
      }
      if (ev.dtend.getTime() <= ev.dtstart.getTime()) {
        skippedEvents++;
        continue;
      }
      const mapped = mapTitleToTemplate(ev.summary, synonyms);
      if (!mapped) {
        unmatchedCounts.set(ev.summary, (unmatchedCounts.get(ev.summary) || 0) + 1);
      }
      trainingEvents.push({
        title: ev.summary,
        start: toISO(ev.dtstart),
        end: toISO(ev.dtend),
        location: ev.location,
        description: ev.description,
        templateId: mapped || undefined,
      });
    }

    totalEvents += trainingEvents.length;
    calendars.push({
      name: calendarName || path.basename(file, path.extname(file)),
      programWeeks,
      daysOfWeek,
      dayStart,
      dayEnd,
      events: trainingEvents,
    });
  }

  return { calendars, totalEvents, skippedEvents, unmatchedCounts };
}

function printUnmatched(unmatchedCounts: Map<string, number>) {
  if (unmatchedCounts.size === 0) return;
  const sorted = Array.from(unmatchedCounts.entries()).sort((a, b) => b[1] - a[1]);
  console.log('Unmatched titles (add to template-synonyms.json if needed):');
  for (const [title, count] of sorted) {
    console.log(`  ${count}x - ${title}`);
  }
}

const _isMain = typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].includes('ics-to-training');
if (_isMain) {
  const args = process.argv.slice(2);
  const inputArg = args[0] || path.join(process.cwd(), 'attached_assets');
  const outputArg = args[1] || DEFAULT_OUTPUT;
  const synonymsPath = args[2] || DEFAULT_SYNONYMS;

  const icsFiles = collectICSFiles([inputArg]);
  if (icsFiles.length === 0) {
    console.error('No .ics files found in', inputArg);
    process.exit(1);
  }

  const synonyms = loadSynonyms(synonymsPath);
  const { calendars, totalEvents, skippedEvents, unmatchedCounts } = buildTrainingCalendars(icsFiles, synonyms);

  fs.writeFileSync(outputArg, JSON.stringify({ calendars }, null, 2), 'utf8');
  console.log(`Wrote training calendars to ${outputArg}`);
  console.log(`Events included: ${totalEvents}, skipped: ${skippedEvents}`);
  printUnmatched(unmatchedCounts);
}
