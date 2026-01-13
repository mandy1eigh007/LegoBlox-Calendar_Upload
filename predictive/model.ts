import fs from 'fs';
import path from 'path';

type NormalizedEvent = {
  calendarName: string;
  programWeeks: number;
  originalTitle: string;
  templateId: string | null;
  startDateISO: string;
  weekIndex: number;
  dayIndex: number;
  startMinuteFromDayStart: number;
  durationMinutes: number;
  location?: string;
};

type TemplateModel = {
  templateId: string;
  totalCount: number;
  weekCounts: Record<string, number>;
  dayCounts: Record<string, number>;
  slotCounts: Record<string, number>;
  durationCounts: Record<string, number>;
  locationCounts: Record<string, number>;
  topSlots: { slotIndex: number; probability: number; count: number }[];
};

function incr(map: Record<string, number>, key: string | number | null) {
  const k = key === null ? 'UNASSIGNED' : String(key);
  map[k] = (map[k] || 0) + 1;
}

export function buildModels(inputPath: string, outPath?: string, topN: number = 5) {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw) as { normalized: NormalizedEvent[] };
  const events = parsed.normalized || [];

  const groups: Record<string, { events: NormalizedEvent[] }> = {};

  for (const ev of events) {
    const key = ev.templateId || 'UNASSIGNED';
    if (!groups[key]) groups[key] = { events: [] };
    groups[key].events.push(ev);
  }

  const models: TemplateModel[] = [];

  for (const [templateId, bucket] of Object.entries(groups)) {
    const weekCounts: Record<string, number> = {};
    const dayCounts: Record<string, number> = {};
    const slotCounts: Record<string, number> = {};
    const durationCounts: Record<string, number> = {};
    const locationCounts: Record<string, number> = {};

    for (const ev of bucket.events) {
      incr(weekCounts, ev.weekIndex);
      incr(dayCounts, ev.dayIndex);
      const slotIndex = Math.round(ev.startMinuteFromDayStart / 15);
      incr(slotCounts, slotIndex);
      incr(durationCounts, ev.durationMinutes);
      incr(locationCounts, ev.location || '');
    }

    const total = bucket.events.length;

    const slotEntries = Object.entries(slotCounts).map(([k, v]) => ({ slotIndex: parseInt(k === 'UNASSIGNED' ? '-1' : k, 10), count: v }));
    slotEntries.sort((a, b) => b.count - a.count);

    const topSlots = slotEntries.slice(0, topN).map(s => ({ slotIndex: s.slotIndex, probability: total > 0 ? s.count / total : 0, count: s.count }));

    models.push({
      templateId,
      totalCount: total,
      weekCounts,
      dayCounts,
      slotCounts,
      durationCounts,
      locationCounts,
      topSlots,
    });
  }

  const out = outPath || path.join(path.dirname(inputPath), 'template-models.json');
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), models }, null, 2), 'utf8');
  return out;
}

const _isMainModel = typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].endsWith('model.ts') || process.argv[1].endsWith('model.js'));
if (_isMainModel) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node model.js <normalized-events.json> [out.json]');
    process.exit(1);
  }
  const inPath = args[0];
  const out = args[1];
  try {
    const written = buildModels(inPath, out);
    console.log('Wrote template models to', written);
  } catch (e) {
    console.error('Failed:', e);
    process.exit(2);
  }
}
