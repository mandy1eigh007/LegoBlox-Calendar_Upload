import React, { useState, useEffect, useMemo } from 'react';
import { Plan, BlockTemplate, Day, DAYS, HardDate } from '@/state/types';
import { generateScheduleSuggestions, SchedulerResult, SuggestedBlock } from '@/lib/predictiveScheduler';
import { buildProbabilityTableFromEvents, fetchSeedCalendars, fetchTraining, persistTraining, serializeProbabilityTable, TrainingEvent, TrainingPayload } from '@/lib/probabilityLearning';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { calculateGoldenRuleTotals } from '@/lib/goldenRule';
import { minutesToTimeDisplay } from '@/lib/time';
import { ConfirmModal, Modal } from './Modal';
import { Loader2, Check, X, AlertTriangle, Sparkles, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface ScheduleSuggestionPanelProps {
  plan: Plan;
  templates: BlockTemplate[];
  currentWeek: number;
  open: boolean;
  onClose: () => void;
  onAccept: (blocks: SuggestedBlock[], options?: { replaceExisting?: boolean; scope?: 'week' | 'all'; targetWeek?: number }) => void;
  onUpdateHardDates: (hardDates: HardDate[]) => void;
}

const MIN_TRAINING_EVENTS = 20;
type BucketTotals = ReturnType<typeof calculateGoldenRuleTotals>;

const buildCoverageFromTotals = (totals: BucketTotals): SchedulerResult['coverage'] =>
  totals.map(total => ({
    bucketId: total.id,
    label: total.label,
    needed: total.budget,
    scheduled: total.scheduled,
    gap: total.isFlexible ? 0 : total.budget - total.scheduled,
  }));

const buildToPlaceFromTotals = (totals: BucketTotals, templates: BlockTemplate[]) =>
  totals
    .filter(total => !total.isFlexible && total.difference < -15)
    .map(total => {
      const deficit = Math.abs(total.difference);
      const template = templates.find(t => t.goldenRuleBucketId === total.id && t.countsTowardGoldenRule);
      const durationMinutes = template?.defaultDurationMinutes || 60;
      const count = Math.ceil(deficit / durationMinutes);
      return { templateId: template?.id ?? null, durationMinutes, count };
    });

export function ScheduleSuggestionPanel({
  plan,
  templates,
  currentWeek,
  open,
  onClose,
  onAccept,
  onUpdateHardDates,
}: ScheduleSuggestionPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SchedulerResult | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<'week' | 'all'>('all');
  const [showHardDates, setShowHardDates] = useState(false);
  const [hardDates, setHardDates] = useState<HardDate[]>(plan.settings.hardDates || []);
  const [generationMode, setGenerationMode] = useState<'fill' | 'scratch'>(() => {
    const totals = calculateGoldenRuleTotals(plan, templates);
    const hasDeficitsInitial = totals.some(t => !t.isFlexible && t.difference < -15);
    return plan.blocks.length > 0 && !hasDeficitsInitial ? 'scratch' : 'fill';
  });
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingReplaceBlocks, setPendingReplaceBlocks] = useState<SuggestedBlock[]>([]);
  const [newHardDate, setNewHardDate] = useState<{ week: number; day: Day; description: string }>({
    week: currentWeek,
    day: 'Monday',
    description: ''
  });
  const [trainingPayload, setTrainingPayload] = useState<TrainingPayload | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [seedLoaded, setSeedLoaded] = useState(false);
  const fallbackTraining = plan.trainingExamples || [];
  const unmatchedTrainingEvents = plan.unmatchedTrainingEvents || [];
  const trainingEvents = trainingPayload?.events ?? fallbackTraining;
  const matchedEvents = trainingEvents.filter(
    (event): event is TrainingEvent & { templateId: string } => !!event.templateId
  );
  const unmatchedEvents = trainingPayload
    ? trainingEvents.filter(event => !event.templateId)
    : [];
  const trainingEventsCount = matchedEvents.length + unmatchedEvents.length + unmatchedTrainingEvents.length;
  const trainingTemplatesCount = new Set(matchedEvents.map(example => example.templateId)).size;
  const trainingReady = trainingPayload !== null || fallbackTraining.length > 0 || unmatchedTrainingEvents.length > 0;
  const noTrainingMatch = trainingReady && trainingTemplatesCount === 0;
  const limitedTraining = trainingReady && trainingEventsCount > 0 && trainingEventsCount < MIN_TRAINING_EVENTS;
  const importMatchedEvents = matchedEvents.filter(example => example.source?.startsWith('import')).length;
  const importUnmatchedEvents = unmatchedTrainingEvents.filter(event => event.source?.startsWith('import')).length;
  const importTotalEvents = importMatchedEvents + importUnmatchedEvents;
  const importMatchRate = importTotalEvents > 0
    ? Math.round((importMatchedEvents / importTotalEvents) * 100)
    : null;
  const topTemplates = useMemo(() => {
    const counts = new Map<string, number>();
    for (const example of matchedEvents) {
      if (!example.templateId) continue;
      counts.set(example.templateId, (counts.get(example.templateId) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([templateId, count]) => ({
        templateId,
        count,
        title: templates.find(t => t.id === templateId)?.title || templateId,
      }));
  }, [matchedEvents, templates]);
  const unmatchedTitles = useMemo(
    () => [
      ...unmatchedEvents.map(event => event.title || '').filter(Boolean),
      ...unmatchedTrainingEvents.map(event => event.title).filter(Boolean),
    ].slice(0, 10),
    [unmatchedEvents, unmatchedTrainingEvents]
  );
  const unmatchedTitlesCount = unmatchedEvents.length + unmatchedTrainingEvents.length;
  const isFromScratch = generationMode === 'scratch';
  const planForCalc = useMemo(
    () => (isFromScratch ? { ...plan, blocks: [] } : plan),
    [plan, isFromScratch]
  );
  const baseTotals = useMemo(() => calculateGoldenRuleTotals(planForCalc, templates), [planForCalc, templates]);
  const hasDeficits = baseTotals.some(t => !t.isFlexible && t.difference < -15);

  useEffect(() => {
    setHardDates(plan.settings.hardDates || []);
  }, [plan.settings.hardDates]);

  useEffect(() => {
    if (!open) return;
    const totals = calculateGoldenRuleTotals(plan, templates);
    const hasDeficitsInitial = totals.some(t => !t.isFlexible && t.difference < -15);
    const nextMode = plan.blocks.length > 0 && !hasDeficitsInitial ? 'scratch' : 'fill';
    setGenerationMode(nextMode);
  }, [open, plan.id, plan.blocks.length, templates]);

  const remapTrainingEvents = (events: TrainingEvent[]) => {
    let updated = false;
    const mapped = events.map(event => {
      if (!event.templateId) return event;
      if (templates.some(t => t.id === event.templateId)) return event;
      const match = resolveTemplateForImportedTitle(event.title || event.templateId, templates);
      if (match.templateId) {
        updated = true;
        return { ...event, templateId: match.templateId };
      }
      return event;
    });
    return { mapped, updated };
  };

  useEffect(() => {
    if (!open) return;
    let active = true;
    setTrainingLoading(true);
    fetchTraining(plan.id).then(async payload => {
      if (!active) return;
      setSeedLoaded(false);
      if (!payload) {
        setTrainingPayload(null);
        setTrainingLoading(false);
        return;
      }
      let nextPayload = payload;
      const totalEvents = payload.probabilityTable?.totalEvents || 0;
      let usedSeed = false;
      if (totalEvents === 0 || (payload.events || []).length === 0) {
        const seedEvents = await fetchSeedCalendars();
        if (seedEvents.length > 0) {
          const { mapped } = remapTrainingEvents(seedEvents);
          const rebuilt = buildProbabilityTableFromEvents(mapped);
          nextPayload = {
            probabilityTable: serializeProbabilityTable(rebuilt),
            events: mapped,
          };
          await persistTraining(plan.id, nextPayload);
          usedSeed = true;
        }
      }
      if (!active) return;
      const { mapped, updated } = remapTrainingEvents(nextPayload.events || []);
      if (updated) {
        const rebuilt = buildProbabilityTableFromEvents(mapped);
        nextPayload = {
          probabilityTable: serializeProbabilityTable(rebuilt),
          events: mapped,
        };
        void persistTraining(plan.id, nextPayload);
      }
      const hasSeedEvents = (nextPayload.events || []).some(event => event.source === 'seed');
      setSeedLoaded(usedSeed || hasSeedEvents);
      setTrainingPayload(nextPayload);
      setTrainingLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, plan.id, templates]);

  const normalizeKey = (value: string) =>
    value.toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const addHardDate = () => {
    if (!newHardDate.description.trim()) return;
    const id = `hd-${Date.now()}`;
    const updated = [...hardDates, { ...newHardDate, id }];
    setHardDates(updated);
    onUpdateHardDates(updated);
    setNewHardDate({ week: currentWeek, day: 'Monday', description: '' });
  };

  const removeHardDate = (id: string) => {
    const updated = hardDates.filter(hd => hd.id !== id);
    setHardDates(updated);
    onUpdateHardDates(updated);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      // First run local analysis to compute deficits and coverage
      const local = generateScheduleSuggestions(planForCalc, templates, {
        targetWeek: currentWeek,
        totalWeeks: plan.settings.weeks,
        dayStartMinutes: plan.settings.dayStartMinutes,
        dayEndMinutes: plan.settings.dayEndMinutes,
        slotMinutes: plan.settings.slotMinutes,
        distributeAcrossWeeks: scope === 'all',
        hardDates: hardDates.map(hd => ({ week: hd.week, day: hd.day })),
        activeDays: plan.settings.activeDays,
        trainingEvents: matchedEvents,
      });

      if (noTrainingMatch) {
        const fallback = {
          ...local,
          suggestions: local.suggestions.map(suggestion => ({
            ...suggestion,
            reason: suggestion.reason || 'No training match. Using budget-only heuristic.',
          })),
        };
        setResult(fallback);
        setSelectedBlocks(new Set(fallback.suggestions.map(s => s.id)));
        setIsGenerating(false);
        return;
      }

      const toPlace = buildToPlaceFromTotals(baseTotals, templates);

      if (scope === 'all' || toPlace.length === 0 || trainingTemplatesCount > 0) {
        setResult(local);
        setSelectedBlocks(new Set(local.suggestions.map(s => s.id)));
        setIsGenerating(false);
        return;
      }

      const templateTitlesById = templates.reduce((acc, template) => {
        acc[template.id] = template.title;
        return acc;
      }, {} as Record<string, string>);

      // fetch predictive models (if any), then call server solver for placements
      fetch('/api/predictive/models')
        .then(r => r.ok ? r.json() : Promise.resolve(null))
        .then((m) => {
          const models = m?.models || null;
          const existingBlocks = isFromScratch
            ? []
            : plan.blocks.filter(b => b.week === currentWeek).map(b => ({
                id: b.id,
                templateId: b.templateId,
                week: b.week,
                day: b.day,
                startMinutes: b.startMinutes,
                durationMinutes: b.durationMinutes,
              }));

          return fetch('/api/predictive/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPlace,
              week: currentWeek,
              existingBlocks,
              dayStartMinutes: plan.settings.dayStartMinutes,
              dayEndMinutes: plan.settings.dayEndMinutes,
              slotMinutes: plan.settings.slotMinutes,
              templateTitlesById,
              activeDays: plan.settings.activeDays,
            }),
          }).then(r => r.json()).then((solverResult) => ({ solverResult, models }));
        })
        .then(({ solverResult, models }: any) => {
          // solverResult.placed -> map to SuggestedBlock[] and compute confidence from models
          const mapped: SuggestedBlock[] = (solverResult.placed || []).map((p: any) => {
            const slotIndex = p.startMinutes != null ? Math.round((p.startMinutes - plan.settings.dayStartMinutes) / plan.settings.slotMinutes) : -1;
            let confidence: number | undefined = undefined;
            const dayValue = typeof p.day === 'number' ? (DAYS[p.day] || DAYS[0]) : p.day;
            if (models) {
              const templateTitle = p.templateId ? templateTitlesById[p.templateId] : null;
              const normalizedTitle = templateTitle ? normalizeKey(templateTitle) : null;
              const modelFor =
                models.find((x: any) => x.templateId === (p.templateId || 'UNASSIGNED')) ||
                (normalizedTitle ? models.find((x: any) => normalizeKey(String(x.templateId || '')) === normalizedTitle) : null) ||
                models.find((x: any) => x.templateId === 'UNASSIGNED');
              if (modelFor && Array.isArray(modelFor.topSlots)) {
                const match = modelFor.topSlots.find((s: any) => s.slotIndex === slotIndex);
                if (match) confidence = match.probability;
              }
            }

            return {
              id: p.id,
              templateId: p.templateId,
              week: p.week,
              day: dayValue,
              startMinutes: p.startMinutes,
              durationMinutes: p.durationMinutes,
              titleOverride: '',
              location: p.location || '',
              notes: '',
              countsTowardGoldenRule: !!p.templateId,
              goldenRuleBucketId: null,
              recurrenceSeriesId: null,
              isRecurrenceException: false,
              resource: undefined,
              isLocked: false,
              isAfterHours: false,
              isNew: true,
              bucketLabel: p.templateId ? (templates.find(t => t.id === p.templateId)?.title || '') : 'Unassigned',
              confidence,
              reason: p.templateId ? 'Server-suggested' : 'Server-unassigned',
            } as SuggestedBlock;
          });

          const coverage = buildCoverageFromTotals(
            calculateGoldenRuleTotals({ ...planForCalc, blocks: [...planForCalc.blocks, ...mapped] }, templates)
          );

          const out: SchedulerResult = {
            suggestions: mapped,
            coverage,
            conflicts: (solverResult.unplaced || []).map((u: any) => typeof u === 'string' ? u : JSON.stringify(u)),
            stats: {
              totalBlocks: mapped.length,
              totalMinutes: mapped.reduce((s, b) => s + b.durationMinutes, 0),
              filledSlots: mapped.reduce((s, b) => s + (b.durationMinutes / plan.settings.slotMinutes), 0),
              emptySlots: 0,
            }
          };

          setResult(out);
          setSelectedBlocks(new Set(out.suggestions.map(s => s.id)));
          setIsGenerating(false);
        })
        .catch(() => {
          setResult(local);
          setSelectedBlocks(new Set(local.suggestions.map(s => s.id)));
          setIsGenerating(false);
        });
    }, 500);
  };

  const toggleBlock = (id: string) => {
    const newSelected = new Set(selectedBlocks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBlocks(newSelected);
  };

  const selectAll = () => {
    if (result) {
      setSelectedBlocks(new Set(result.suggestions.map(s => s.id)));
    }
  };

  const deselectAll = () => {
    setSelectedBlocks(new Set());
  };

  const handleAccept = () => {
    if (!result) return;
    const acceptedBlocks = result.suggestions.filter(s => selectedBlocks.has(s.id));
    if (acceptedBlocks.length === 0) return;
    if (isFromScratch) {
      setPendingReplaceBlocks(acceptedBlocks);
      setShowReplaceConfirm(true);
      return;
    }
    onAccept(acceptedBlocks, { scope, targetWeek: currentWeek });
    onClose();
  };

  const groupedByWeek = result?.suggestions.reduce((acc, block) => {
    if (!acc[block.week]) acc[block.week] = [];
    acc[block.week].push(block);
    return acc;
  }, {} as Record<number, SuggestedBlock[]>) || {};

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const matchRateLabel = importMatchRate !== null ? `${importMatchRate}%` : '—';

  return (
    <Modal open={open} onClose={onClose} title="Predictive Schedule Generator">
      <div className="space-y-4 sm:max-h-[70vh] sm:overflow-y-auto">
        {!result && !isGenerating && (
          <div className="space-y-4">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <h3 className="font-medium text-foreground">Smart Schedule Generation</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will analyze your Golden Rule budget requirements and generate
                    suggested blocks to fill any gaps in your schedule.
                  </p>
                </div>
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${noTrainingMatch ? 'bg-amber-900/20 border-amber-500/40' : 'bg-secondary/40 border-border'}`}>
              <div className="text-sm text-foreground">
                {trainingLoading && !trainingReady ? (
                  <span>Loading training from server...</span>
                ) : (
                  <>
                    Training: {trainingEventsCount} events, {trainingTemplatesCount} templates.
                    {importMatchRate !== null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        Match rate (import): {importMatchRate}%
                      </span>
                    )}
                  </>
                )}
              </div>
              {noTrainingMatch && (
                <p className="text-xs text-amber-300 mt-1">
                  No training match. Using budget-only heuristic.
                </p>
              )}
              {limitedTraining && !noTrainingMatch && (
                <p className="text-xs text-muted-foreground mt-1">
                  Limited training data. Suggestions will lean on learned patterns where available.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
              <div className="text-sm font-medium text-foreground">Training Debug</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Seed loaded: {seedLoaded ? 'true' : 'false'}</div>
                <div>Training events: {trainingEventsCount}</div>
                <div>Training templates: {trainingTemplatesCount}</div>
                <div>Matched / Unmatched: {matchedEvents.length} / {unmatchedTitlesCount}</div>
                <div>Unmatched titles: {unmatchedTitlesCount}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="font-medium text-foreground">Top templates</div>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {topTemplates.length > 0 ? (
                      topTemplates.map(item => (
                        <li key={item.templateId}>{item.title} ({item.count})</li>
                      ))
                    ) : (
                      <li>None</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-foreground">Unmatched titles</div>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {unmatchedTitles.length > 0 ? (
                      unmatchedTitles.map((title, index) => (
                        <li key={`${title}-${index}`}>{title}</li>
                      ))
                    ) : (
                      <li>None</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Generation Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScope('week')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'week' ? 'border-accent bg-accent/20' : 'border-border hover:border-muted-foreground'
                  }`}
                  data-testid="scope-week"
                >
                  <div className="font-medium text-sm text-foreground">Current Week Only</div>
                  <div className="text-xs text-muted-foreground mt-1">Fill gaps in Week {currentWeek}</div>
                </button>
                <button
                  onClick={() => setScope('all')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'all' ? 'border-accent bg-accent/20' : 'border-border hover:border-muted-foreground'
                  }`}
                  data-testid="scope-all"
                >
                  <div className="font-medium text-sm text-foreground">All Weeks</div>
                  <div className="text-xs text-muted-foreground mt-1">Distribute across {plan.settings.weeks} weeks</div>
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowHardDates(!showHardDates)}
                className="w-full px-4 py-3 flex items-center justify-between text-left bg-secondary/30 hover:bg-secondary/50 transition-colors"
                data-testid="toggle-hard-dates"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="font-medium text-sm text-foreground">Fixed Dates (Off Days)</span>
                  {hardDates.length > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded-full">
                      {hardDates.length}
                    </span>
                  )}
                </div>
                {showHardDates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              
              {showHardDates && (
                <div className="p-4 space-y-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Add days that should be skipped during schedule generation (holidays, field trips, etc.)
                  </p>
                  
                  <div className="flex gap-2">
                    <select
                      value={newHardDate.week}
                      onChange={e => setNewHardDate({ ...newHardDate, week: parseInt(e.target.value) })}
                      className="px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground"
                    >
                      {Array.from({ length: plan.settings.weeks }, (_, i) => i + 1).map(w => (
                        <option key={w} value={w}>Wk {w}</option>
                      ))}
                    </select>
                    <select
                      value={newHardDate.day}
                      onChange={e => setNewHardDate({ ...newHardDate, day: e.target.value as Day })}
                      className="px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Description (e.g., Holiday)"
                      value={newHardDate.description}
                      onChange={e => setNewHardDate({ ...newHardDate, description: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={addHardDate}
                      disabled={!newHardDate.description.trim()}
                      className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-all"
                      data-testid="add-hard-date"
                    >
                      Add
                    </button>
                  </div>
                  
                  {hardDates.length > 0 && (
                    <div className="space-y-1">
                      {hardDates.map(hd => (
                        <div key={hd.id} className="flex items-center justify-between px-3 py-2 bg-secondary/30 rounded-lg">
                          <span className="text-sm text-foreground">
                            <span className="font-medium">Wk {hd.week}, {hd.day}:</span> {hd.description}
                          </span>
                          <button
                            onClick={() => removeHardDate(hd.id)}
                            className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            data-testid={`remove-hard-date-${hd.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={isFromScratch}
                  onChange={e => setGenerationMode(e.target.checked ? 'scratch' : 'fill')}
                  className="accent-primary"
                  data-testid="generate-from-scratch"
                />
                Generate from scratch (ignore existing blocks)
              </label>
              <p className="text-xs text-muted-foreground">
                When you accept suggestions, this will replace blocks in the selected scope.
              </p>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:opacity-90 glow-accent flex items-center justify-center gap-2 transition-all"
              data-testid="generate-suggestions"
            >
              <Sparkles className="w-4 h-4" />
              Generate Schedule Suggestions
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className="text-sm text-muted-foreground mt-4">Analyzing budget gaps and generating suggestions...</p>
          </div>
        )}

        {result && !isGenerating && (
          <div className="space-y-4">
            {noTrainingMatch && (
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
                No training match. Using a budget-only heuristic draft so you can confirm or adjust placements.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">{result.stats.totalBlocks}</div>
                <div className="text-sm sm:text-xs text-muted-foreground">Blocks Generated</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">{formatDuration(result.stats.totalMinutes)}</div>
                <div className="text-sm sm:text-xs text-muted-foreground">Total Time</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">{matchRateLabel}</div>
                <div className="text-sm sm:text-xs text-muted-foreground">Match Rate (import)</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">
                  {result.coverage.filter(c => Math.abs(c.gap) <= 15).length}/{result.coverage.length}
                </div>
                <div className="text-sm sm:text-xs text-muted-foreground">Budgets Met</div>
              </div>
            </div>

            {result.suggestions.length === 0 && (
              <div className="bg-secondary/30 border border-border rounded-lg p-3 text-sm text-muted-foreground">
                {hasDeficits
                  ? 'No open time slots were available to place the remaining hours. Try clearing time or removing hard dates.'
                  : 'All Golden Rule budgets are already met. Suggestions only fill gaps, so a full calendar may return zero.'}
              </div>
            )}

            {result.conflicts.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-300">
                    <p className="font-medium">Some budgets could not be fully met:</p>
                    <ul className="mt-1 text-xs text-amber-400 space-y-1">
                      {result.conflicts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 gap-2">
                <span className="text-base sm:text-sm font-medium text-foreground">Suggested Blocks ({result.suggestions.length})</span>
                <div className="flex gap-2 text-sm sm:text-xs">
                  <button onClick={selectAll} className="text-accent hover:underline">Select All</button>
                  <span className="text-muted-foreground">|</span>
                  <button onClick={deselectAll} className="text-accent hover:underline">Deselect All</button>
                </div>
              </div>

              <div className="border border-border rounded-lg max-h-[55vh] sm:max-h-64 overflow-y-auto">
                {Object.entries(groupedByWeek).map(([weekNum, blocks]) => (
                  <div key={weekNum}>
                    <div className="bg-secondary/50 px-3 py-1 text-sm sm:text-xs font-medium text-muted-foreground sticky top-0">
                      Week {weekNum}
                    </div>
                    {blocks.map(block => {
                      const template = templates.find(t => t.id === block.templateId);
                      return (
                        <label
                          key={block.id}
                          className="flex items-center gap-3 px-3 py-3 sm:py-2 hover:bg-secondary/30 cursor-pointer border-b border-border last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBlocks.has(block.id)}
                            onChange={() => toggleBlock(block.id)}
                            className="h-5 w-5 sm:h-4 sm:w-4 rounded accent-primary"
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: template?.colorHex || '#6366f1' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-base sm:text-sm font-medium text-foreground truncate">{block.bucketLabel}</div>
                            </div>
                            <div className="text-sm sm:text-xs text-muted-foreground">
                              {block.day} {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(block.startMinutes + block.durationMinutes)} ({formatDuration(block.durationMinutes)})
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => { setResult(null); setSelectedBlocks(new Set()); }}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              >
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                disabled={selectedBlocks.size === 0}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 glow-accent disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                data-testid="accept-suggestions"
              >
                <Check className="w-4 h-4" />
                Accept {selectedBlocks.size} Block{selectedBlocks.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
      <ConfirmModal
        open={showReplaceConfirm}
        onClose={() => {
          setShowReplaceConfirm(false);
          setPendingReplaceBlocks([]);
        }}
        onConfirm={() => {
          onAccept(pendingReplaceBlocks, { replaceExisting: true, scope, targetWeek: currentWeek });
          setShowReplaceConfirm(false);
          setPendingReplaceBlocks([]);
          onClose();
        }}
        title="Replace existing blocks?"
        message={`This will remove existing blocks in the ${scope === 'week' ? 'current week' : 'entire plan'} and add the selected suggestions. This cannot be undone.`}
        confirmText="Replace & Apply"
        cancelText="Cancel"
      />
    </Modal>
  );
}
