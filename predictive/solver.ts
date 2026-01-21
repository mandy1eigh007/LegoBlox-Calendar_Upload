import { v4 as uuidv4 } from 'uuid';
import { loadModels, getTopSlotCandidates } from './probability';
import fs from 'fs';
import path from 'path';

type SuggestedPlacedBlock = {
  id: string;
  templateId: string | null;
  week: number;
  day: number; // 0=Mon..6=Sun
  startMinutes: number;
  durationMinutes: number;
  titleOverride?: string;
  location?: string;
};

type ExistingBlock = {
  id: string;
  templateId: string | null;
  week: number;
  day: number;
  startMinutes: number;
  durationMinutes: number;
};

function overlaps(a: { week: number; day: number; startMinutes: number; durationMinutes: number }, b: { week: number; day: number; startMinutes: number; durationMinutes: number }) {
  if (a.week !== b.week || a.day !== b.day) return false;
  const aEnd = a.startMinutes + a.durationMinutes;
  const bEnd = b.startMinutes + b.durationMinutes;
  return a.startMinutes < bEnd && b.startMinutes < aEnd;
}

export function suggestSchedule(
  toPlace: { templateId: string | null; durationMinutes: number; count?: number }[],
  modelsPath?: string,
  existingBlocks: ExistingBlock[] = [],
  week = 1,
  dayStartMinutes = 390,
  dayEndMinutes = 930,
  slotMinutes = 15,
  templateTitlesById?: Record<string, string>
): { placed: SuggestedPlacedBlock[]; unplaced: { templateId: string | null; count: number }[] } {
  const models = loadModels(modelsPath);
  const placed: SuggestedPlacedBlock[] = [];
  const allowedDays = [0, 1, 2, 3, 4];

  // simple availability list starts with existing blocks
  const occupied: ExistingBlock[] = [...existingBlocks];

  const unplaced: Record<string, number> = {};

  const normalizeKey = (value: string) =>
    value.toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const item of toPlace) {
    const targetCount = item.count ?? 1;
    let placedCount = 0;
    const modelKey = item.templateId || 'UNASSIGNED';
    let model = models.find(m => m.templateId === modelKey) || null;
    if (!model && item.templateId && templateTitlesById) {
      const title = templateTitlesById[item.templateId];
      if (title) {
        const normalizedTitle = normalizeKey(title);
        model = models.find(m => normalizeKey(m.templateId) === normalizedTitle) || null;
      }
    }

    // derive preferred days order from dayCounts in model
    let preferredDays: number[] = [...allowedDays];
    if (model && model.dayCounts) {
      preferredDays = Object.entries(model.dayCounts)
        .map(([k,v]) => ({ day: parseInt(k === 'UNASSIGNED' ? '-1' : k, 10), count: v }))
        .filter(d => allowedDays.includes(d.day))
        .sort((a,b) => b.count - a.count)
        .map(d => d.day);
      if (preferredDays.length === 0) preferredDays = [...allowedDays];
    }

    const slotCandidates = model ? (model.topSlots || []).map(s => s.slotIndex).filter(i => i >= 0) : [Math.floor(( (dayStartMinutes+60) - dayStartMinutes) / slotMinutes)];

    for (let i = 0; i < targetCount; i++) {
      let placedThis = false;
      // try preferred days then fallback
      const daysToTry = preferredDays.concat(allowedDays.filter(d => !preferredDays.includes(d)));
      for (const day of daysToTry) {
        for (const slotIndex of slotCandidates) {
          const startMinutes = dayStartMinutes + slotIndex * slotMinutes;
          if (startMinutes + item.durationMinutes > dayEndMinutes) continue;
          const candidate = { week, day, startMinutes, durationMinutes: item.durationMinutes };
          const conflict = occupied.some(o => overlaps(o as any, candidate));
          if (!conflict) {
            const pb: SuggestedPlacedBlock = {
              id: uuidv4(),
              templateId: item.templateId,
              week,
              day,
              startMinutes,
              durationMinutes: item.durationMinutes,
            };
            placed.push(pb);
            occupied.push(pb as ExistingBlock);
            placedThis = true;
            break;
          }
        }
        if (placedThis) break;
      }

      if (!placedThis) {
        // try brute force over all possible slots
        let found = false;
        for (const day of allowedDays) {
          if (found) break;
          for (let m = dayStartMinutes; m + item.durationMinutes <= dayEndMinutes; m += slotMinutes) {
            const candidate = { week, day, startMinutes: m, durationMinutes: item.durationMinutes };
            const conflict = occupied.some(o => overlaps(o as any, candidate));
            if (!conflict) {
              const pb: SuggestedPlacedBlock = {
                id: uuidv4(),
                templateId: item.templateId,
                week,
                day,
                startMinutes: m,
                durationMinutes: item.durationMinutes,
              };
              placed.push(pb);
              occupied.push(pb as ExistingBlock);
              found = true;
              break;
            }
          }
        }
        if (!found) {
          const key = item.templateId || 'UNASSIGNED';
          unplaced[key] = (unplaced[key] || 0) + 1;
        }
      }
    }
  }

  return { placed, unplaced: Object.entries(unplaced).map(([templateId, count]) => ({ templateId: templateId === 'UNASSIGNED' ? null : templateId, count })) };
}

// simple CLI
const _isMainSolver = typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].endsWith('solver.ts') || process.argv[1].endsWith('solver.js'));
if (_isMainSolver) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node solver.js <models.json> <toPlace.json>');
    process.exit(1);
  }
  const modelsPath = args[0];
  const toPlacePath = args[1];
  const models = loadModels(modelsPath);
  const toPlaceRaw = JSON.parse(fs.readFileSync(toPlacePath, 'utf8')) as { templateId: string | null; durationMinutes: number; count?: number }[];
  const result = suggestSchedule(toPlaceRaw, modelsPath, [], 1);
  const out = path.join(path.dirname(toPlacePath), 'suggested-schedule.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote suggestions to', out);
}
