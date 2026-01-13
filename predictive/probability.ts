import fs from 'fs';
import path from 'path';

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

export function loadModels(modelsPath?: string): TemplateModel[] {
  const p = modelsPath || path.join(process.cwd(), 'predictive', 'template-models.json');
  const raw = fs.readFileSync(p, 'utf8');
  const parsed = JSON.parse(raw) as { generatedAt?: string; models: TemplateModel[] };
  return parsed.models || [];
}

export function getTopSlotCandidates(
  models: TemplateModel[] | undefined,
  templateId: string,
  dayStartMinutes = 390,
  slotMinutes = 15,
  topN = 5
) {
  if (!models) return [];
  const model = models.find(m => m.templateId === templateId) || models.find(m => m.templateId === 'UNASSIGNED');
  if (!model) return [];

  // Convert slotIndex back to minute-of-day
  const candidates = (model.topSlots || []).slice(0, topN).map(s => ({
    slotIndex: s.slotIndex,
    startMinutes: s.slotIndex >= 0 ? dayStartMinutes + s.slotIndex * slotMinutes : null,
    probability: s.probability,
    count: s.count,
  }));

  // gather top durations
  const durations = Object.entries(model.durationCounts || {})
    .map(([k, v]) => ({ duration: parseInt(k === 'UNASSIGNED' ? '0' : k, 10), count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(d => d.duration);

  return { templateId: model.templateId, totalCount: model.totalCount, candidates, topDurations: durations };
}

const _isMainProb = typeof process !== 'undefined' && process.argv && process.argv[1] && (process.argv[1].endsWith('probability.ts') || process.argv[1].endsWith('probability.js'));
if (_isMainProb) {
  const args = process.argv.slice(2);
  const modelsPath = args[0] || path.join(process.cwd(), 'predictive', 'template-models.json');
  const templateId = args[1];
  try {
    const models = loadModels(modelsPath);
    if (templateId) {
      console.log(JSON.stringify(getTopSlotCandidates(models, templateId), null, 2));
    } else {
      console.log(JSON.stringify({ generatedAt: new Date().toISOString(), templates: models.map(m => ({ templateId: m.templateId, totalCount: m.totalCount })) }, null, 2));
    }
  } catch (e) {
    console.error('Error loading models:', e);
    process.exit(2);
  }
}
