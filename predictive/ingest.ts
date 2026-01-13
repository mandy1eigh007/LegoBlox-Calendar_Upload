import fs from 'fs';
import path from 'path';

type TrainingCalendar = {
  name: string;
  programWeeks?: number;
  daysOfWeek?: string[]; // e.g. ["Tue","Wed","Thu","Fri"]
  dayStart?: string; // "06:30"
  dayEnd?: string; // "15:30"
  events: Array<{
    title: string;
    start: string; // ISO
    end: string; // ISO
    location?: string;
    description?: string;
    templateId?: string;
  }>;
};

type NormalizedEvent = {
  calendarName: string;
  programWeeks: number;
  originalTitle: string;
  templateId: string | null; // null -> UNASSIGNED
  startDateISO: string;
  weekIndex: number; // 1..9
  dayIndex: number; // 0..N-1 in program daysOfWeek
  startMinuteFromDayStart: number; // 0..420
  durationMinutes: number; // multiple of 15
  location?: string;
};

function parseHM(hm: string) {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function normalizeText(s: string) {
  return (s || '').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function roundTo15(n: number) {
  return Math.max(15, Math.round(n / 15) * 15);
}

function weekdayNameFromDate(d: Date): string {
  // Return e.g. Mon, Tue, Wed
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

export function loadSynonyms(synonymsPath: string): Record<string, string[]> {
  if (!fs.existsSync(synonymsPath)) return {};
  const raw = fs.readFileSync(synonymsPath, 'utf8');
  return JSON.parse(raw) as Record<string, string[]>;
}

function mapTitleToTemplate(title: string, synonyms: Record<string, string[]>): string | null {
  const norm = normalizeText(title);
  // exact canonical match
  for (const canonical of Object.keys(synonyms)) {
    if (normalizeText(canonical) === norm) return canonical;
  }

  // search synonyms
  for (const [canonical, syns] of Object.entries(synonyms)) {
    for (const s of syns) {
      const n = normalizeText(s);
      if (n && norm.includes(n)) return canonical;
    }
  }

  // fallback: check words in title against canonical tokens
  for (const canonical of Object.keys(synonyms)) {
    const ncanon = normalizeText(canonical);
    if (ncanon && norm.includes(ncanon)) return canonical;
  }

  return null;
}

export function normalizeTrainingCalendars(inputPath: string, synonymsPath?: string, outPath?: string) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as { calendars: TrainingCalendar[] };
  const synonyms = synonymsPath ? loadSynonyms(synonymsPath) : {};

  const normalized: NormalizedEvent[] = [];

  for (const cal of parsed.calendars || []) {
    const programWeeks = cal.programWeeks || 9;
    const daysOfWeek = cal.daysOfWeek && cal.daysOfWeek.length > 0 ? cal.daysOfWeek : ['Mon','Tue','Wed','Thu','Fri'];
    const dayStartMinutes = cal.dayStart ? parseHM(cal.dayStart) : parseHM('06:30');
    // Determine calendar start date (earliest event start)
    const eventDates = (cal.events || []).map(e => new Date(e.start));
    if (eventDates.length === 0) continue;
    const minTs = Math.min(...eventDates.map(d => d.getTime()));
    const calendarStartDate = new Date(minTs);
    calendarStartDate.setHours(0,0,0,0);

    for (const ev of cal.events || []) {
      const start = new Date(ev.start);
      const end = new Date(ev.end);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

      const dayOnly = new Date(start);
      dayOnly.setHours(0,0,0,0);
      const diffDays = Math.floor((dayOnly.getTime() - calendarStartDate.getTime()) / (1000*60*60*24));
      const oldWeek = Math.floor(diffDays / 7) + 1;
      const newWeek = Math.min(9, Math.max(1, Math.ceil(9 * oldWeek / Math.max(1, programWeeks))));

      const weekdayShort = weekdayNameFromDate(start); // Mon, Tue, ...
      let dayIndex = daysOfWeek.indexOf(weekdayShort);
      if (dayIndex === -1) {
        // try full names
        const full = start.toLocaleDateString('en-US', { weekday: 'long' });
        dayIndex = daysOfWeek.indexOf(full.slice(0,3));
      }
      if (dayIndex === -1) {
        // fallback: map Mon-Fri to 0..4 by getDay
        const dow = start.getDay(); // 0..6 Sun..Sat
        dayIndex = Math.max(0, Math.min(4, dow - 1));
      }

      const startMinOfDay = start.getHours()*60 + start.getMinutes();
      let startMinuteFromDayStart = startMinOfDay - dayStartMinutes;
      if (startMinuteFromDayStart < 0) startMinuteFromDayStart = 0;
      if (startMinuteFromDayStart > 420) startMinuteFromDayStart = 420;

      const duration = Math.round((end.getTime() - start.getTime()) / (1000*60));
      const durationRounded = roundTo15(duration);

      let mappedTemplate: string | null = null;
      if (ev.templateId) mappedTemplate = ev.templateId;
      else mappedTemplate = mapTitleToTemplate(ev.title || '', synonyms);

      normalized.push({
        calendarName: cal.name || 'Unnamed',
        programWeeks,
        originalTitle: ev.title || '',
        templateId: mappedTemplate, // canonical title or null
        startDateISO: start.toISOString(),
        weekIndex: newWeek,
        dayIndex,
        startMinuteFromDayStart: startMinuteFromDayStart,
        durationMinutes: durationRounded,
        location: ev.location || undefined,
      });
    }
  }

  const out = outPath || path.join(path.dirname(inputPath), 'normalized-events.json');
  fs.writeFileSync(out, JSON.stringify({ normalized }, null, 2), 'utf8');
  return out;
}

const _isMain = typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].endsWith('ingest.ts') || process.argv[1].endsWith('ingest.js'));
if (_isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node ingest.js <training-calendars.json> [template-synonyms.json] [out.json]');
    process.exit(1);
  }
  const inPath = args[0];
  const syn = args[1];
  const out = args[2];
  try {
    const written = normalizeTrainingCalendars(inPath, syn, out);
    console.log('Wrote normalized events to', written);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(2);
  }
}
