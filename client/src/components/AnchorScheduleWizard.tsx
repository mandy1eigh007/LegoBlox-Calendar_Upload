import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { BlockTemplate, Plan, AnchorPromptId, AnchorEventDraft, PlacedBlock, DAYS } from '@/state/types';
import { ANCHOR_PROMPTS, AnchorScheduleSelection, buildAnchorDateDraft, buildAnchorWeeklyDraft, buildBlocksFromDraft, createAnchorSelections } from '@/lib/anchorPrompts';
import { minutesToTimeDisplay } from '@/lib/time';
import { getWeekDayFromDate } from '@/lib/dateMapping';
import { v4 as uuidv4 } from 'uuid';

interface AnchorScheduleWizardProps {
  open: boolean;
  plan: Plan;
  templates: BlockTemplate[];
  onClose: () => void;
  onApply: (updates: { anchorSchedule: Partial<Record<AnchorPromptId, AnchorEventDraft[]>>; blocks: PlacedBlock[]; dismiss?: boolean }) => void;
}

export function AnchorScheduleWizard({ open, plan, templates, onClose, onApply }: AnchorScheduleWizardProps) {
  const selectedAnchors = useMemo(
    () => ANCHOR_PROMPTS.filter(prompt => plan.settings.anchorChecklist?.[prompt.id]),
    [plan.settings.anchorChecklist]
  );

  const [drafts, setDrafts] = useState<Record<AnchorPromptId, AnchorScheduleSelection>>(
    createAnchorSelections(plan.settings.dayStartMinutes, plan.settings.startDate, plan.settings.activeDays, plan.settings.weeks)
  );
  const [wizardError, setWizardError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = createAnchorSelections(plan.settings.dayStartMinutes, plan.settings.startDate, plan.settings.activeDays, plan.settings.weeks);
    for (const prompt of ANCHOR_PROMPTS) {
      if (!plan.settings.anchorChecklist?.[prompt.id]) continue;
      const existing = plan.settings.anchorSchedule?.[prompt.id] || [];
      const weeklyExisting = existing.find(entry => entry.type === 'weekly');
      base[prompt.id] = {
        ...base[prompt.id],
        enabled: true,
        mode: weeklyExisting ? 'weekly' : base[prompt.id].mode,
        rows: existing.length > 0
          ? existing.filter(entry => entry.type === 'date').map(row => ({
              id: row.id,
              date: row.date,
              startMinutes: row.startMinutes,
              durationMinutes: row.durationMinutes,
              createNow: !row.created,
            }))
          : base[prompt.id].rows,
        weekly: weeklyExisting
          ? {
              startWeek: weeklyExisting.startWeek,
              endWeek: weeklyExisting.endWeek,
              days: weeklyExisting.days,
              startMinutes: weeklyExisting.startMinutes,
              durationMinutes: weeklyExisting.durationMinutes,
              createNow: !weeklyExisting.created,
            }
          : base[prompt.id].weekly,
      };
    }
    setDrafts(base);
    setWizardError(null);
  }, [
    open,
    plan.settings.anchorChecklist,
    plan.settings.anchorSchedule,
    plan.settings.dayStartMinutes,
    plan.settings.startDate,
    plan.settings.activeDays,
    plan.settings.weeks,
  ]);

  if (!open) return null;

  if (selectedAnchors.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Anchor Schedule">
        <p className="text-sm text-muted-foreground">No anchor prompts selected for this plan.</p>
      </Modal>
    );
  }

  const timeOptions: number[] = [];
  for (let m = plan.settings.dayStartMinutes; m <= plan.settings.dayEndMinutes; m += 15) {
    timeOptions.push(m);
  }

  const handleApply = (dismiss: boolean) => {
    setWizardError(null);
    const anchorSchedule: Partial<Record<AnchorPromptId, AnchorEventDraft[]>> = {
      ...(plan.settings.anchorSchedule || {}),
    };
    const blocks: PlacedBlock[] = [];
    const warnings: string[] = [];

    for (const prompt of selectedAnchors) {
      const selection = drafts[prompt.id];
      if (!selection?.enabled) continue;
      const existing = plan.settings.anchorSchedule?.[prompt.id] || [];

      if (selection.mode === 'weekly' && selection.weekly && prompt.supportsWeekly) {
        const weeklyDraft = buildAnchorWeeklyDraft(prompt, selection.weekly);
        const existingWeekly = existing.find(entry => entry.type === 'weekly');
        weeklyDraft.created = existingWeekly?.created || selection.weekly.createNow;
        anchorSchedule[prompt.id] = [weeklyDraft];

        if (selection.weekly.createNow) {
          const result = buildBlocksFromDraft(
            weeklyDraft,
            templates,
            plan.settings.startDate,
            plan.settings.activeDays,
            plan.settings.weeks
          );
          if (result.warnings.length > 0) {
            warnings.push(`${prompt.defaultTitle}: ${result.warnings.join(' ')}`);
          }
          blocks.push(...result.blocks);
        }
      } else {
        const draftsForAnchor: AnchorEventDraft[] = selection.rows.map(row => {
          const existingRow = existing.find(r => r.id === row.id);
          const draft = buildAnchorDateDraft(prompt, row);
          draft.created = existingRow?.created || row.createNow;
          return draft;
        });
        anchorSchedule[prompt.id] = draftsForAnchor;

        for (const draft of draftsForAnchor) {
          const row = selection.rows.find(r => r.id === draft.id);
          if (!row?.createNow) continue;
          const result = buildBlocksFromDraft(
            draft,
            templates,
            plan.settings.startDate,
            plan.settings.activeDays,
            plan.settings.weeks
          );
          if (result.warnings.length > 0) {
            warnings.push(`${prompt.defaultTitle}: ${result.warnings.join(' ')}`);
            continue;
          }
          blocks.push(...result.blocks);
        }
      }
    }

    if (warnings.length > 0) {
      setWizardError(warnings.join(' '));
      return;
    }

    onApply({ anchorSchedule, blocks, dismiss });
  };

  return (
    <Modal open={open} onClose={() => handleApply(true)} title="Schedule Anchor Events">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These anchor events depend on partner schedules. Add them as locked events first so the rest of the calendar can flow around them.
        </p>

        <div className="space-y-3">
          {selectedAnchors.map(prompt => {
            const selection = drafts[prompt.id];
            const existing = plan.settings.anchorSchedule?.[prompt.id] || [];
            return (
              <div key={prompt.id} className="rounded border border-border p-3 bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{prompt.defaultTitle}</p>
                  <div className="flex items-center gap-2">
                    {prompt.supportsWeekly && (
                      <>
                        <button
                          onClick={() => setDrafts({
                            ...drafts,
                            [prompt.id]: { ...selection, mode: 'weekly' },
                          })}
                          className={`text-xs px-2 py-1 rounded border ${
                            selection.mode === 'weekly'
                              ? 'border-accent text-accent'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          Weekly
                        </button>
                        <button
                          onClick={() => setDrafts({
                            ...drafts,
                            [prompt.id]: { ...selection, mode: 'dates' },
                          })}
                          className={`text-xs px-2 py-1 rounded border ${
                            selection.mode === 'dates'
                              ? 'border-accent text-accent'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          Dates
                        </button>
                      </>
                    )}
                    {selection.mode === 'dates' && (
                      <button
                        onClick={() => setDrafts({
                          ...drafts,
                          [prompt.id]: {
                            ...selection,
                            rows: [
                              ...selection.rows,
                              {
                                id: uuidv4(),
                                date: plan.settings.startDate || '',
                                startMinutes: plan.settings.dayStartMinutes,
                                durationMinutes: prompt.defaultDurationMinutes ?? 60,
                                createNow: true,
                              },
                            ],
                          },
                        })}
                        className="text-xs text-accent underline"
                      >
                        Add date
                      </button>
                    )}
                  </div>
                </div>

                {selection.mode === 'weekly' && selection.weekly && (
                  <div className="border border-border rounded-lg p-2 text-xs space-y-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selection.weekly.createNow}
                        onChange={e => setDrafts({
                          ...drafts,
                          [prompt.id]: {
                            ...selection,
                            weekly: { ...selection.weekly!, createNow: e.target.checked },
                          },
                        })}
                      />
                      Create locked events now
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-muted-foreground mb-1">Start week</label>
                        <input
                          type="number"
                          min={1}
                          max={plan.settings.weeks}
                        value={selection.weekly?.startWeek ?? 1}
                          onChange={e => setDrafts({
                            ...drafts,
                            [prompt.id]: {
                              ...selection,
                              weekly: { ...selection.weekly!, startWeek: parseInt(e.target.value) || 1 },
                            },
                          })}
                          className="w-full px-2 py-1 border rounded bg-input"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">End week</label>
                        <input
                          type="number"
                          min={1}
                          max={plan.settings.weeks}
                        value={selection.weekly?.endWeek ?? plan.settings.weeks}
                          onChange={e => setDrafts({
                            ...drafts,
                            [prompt.id]: {
                              ...selection,
                              weekly: { ...selection.weekly!, endWeek: parseInt(e.target.value) || plan.settings.weeks },
                            },
                          })}
                          className="w-full px-2 py-1 border rounded bg-input"
                        />
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">Start Time</label>
                        <select
                        value={selection.weekly?.startMinutes ?? plan.settings.dayStartMinutes}
                          onChange={e => setDrafts({
                            ...drafts,
                            [prompt.id]: {
                              ...selection,
                              weekly: { ...selection.weekly!, startMinutes: parseInt(e.target.value) },
                            },
                          })}
                          className="w-full px-2 py-1 border rounded bg-input"
                        >
                          {timeOptions.map(m => (
                            <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-muted-foreground mb-1">Duration (min)</label>
                        <input
                          type="number"
                          min={15}
                          step={15}
                        value={selection.weekly?.durationMinutes ?? 60}
                          onChange={e => setDrafts({
                            ...drafts,
                            [prompt.id]: {
                              ...selection,
                              weekly: { ...selection.weekly!, durationMinutes: parseInt(e.target.value) || 60 },
                            },
                          })}
                          className="w-full px-2 py-1 border rounded bg-input"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-muted-foreground mb-1">Days</label>
                      <div className="flex flex-wrap gap-2">
                        {(plan.settings.activeDays || DAYS).map(day => (
                          <label key={day} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={selection.weekly?.days.includes(day) ?? false}
                              onChange={e => {
                                const nextDays = new Set(selection.weekly?.days || []);
                                if (e.target.checked) {
                                  nextDays.add(day);
                                } else {
                                  nextDays.delete(day);
                                }
                                setDrafts({
                                  ...drafts,
                                  [prompt.id]: {
                                    ...selection,
                                    weekly: { ...selection.weekly!, days: Array.from(nextDays) },
                                  },
                                });
                              }}
                            />
                            {day.slice(0, 3)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selection.mode === 'dates' && (
                  <div className="space-y-2">
                  {selection.rows.map(row => {
                    const placement = row.date ? getWeekDayFromDate(row.date, plan.settings.startDate) : null;
                    const outOfRange = placement ? placement.week > plan.settings.weeks || placement.week < 1 : false;
                    const isOutsideActive = placement && plan.settings.activeDays?.length
                      ? !plan.settings.activeDays.includes(placement.day)
                      : false;
                    const created = existing.find(r => r.id === row.id)?.created;
                    return (
                      <div key={row.id} className="border border-border rounded-lg p-2 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          {created ? (
                            <span className="text-xs text-green-600">Already added</span>
                          ) : (
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={row.createNow}
                                onChange={e => setDrafts({
                                  ...drafts,
                                  [prompt.id]: {
                                    ...selection,
                                    rows: selection.rows.map(r => r.id === row.id ? { ...r, createNow: e.target.checked } : r),
                                  },
                                })}
                              />
                              Create now
                            </label>
                          )}
                          {selection.rows.length > 1 && !created && (
                            <button
                              onClick={() => setDrafts({
                                ...drafts,
                                [prompt.id]: {
                                  ...selection,
                                  rows: selection.rows.filter(r => r.id !== row.id),
                                },
                              })}
                              className="text-xs text-red-400"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-muted-foreground mb-1">Date</label>
                            <input
                              type="date"
                              value={row.date}
                              onChange={e => setDrafts({
                                ...drafts,
                                [prompt.id]: {
                                  ...selection,
                                  rows: selection.rows.map(r => r.id === row.id ? { ...r, date: e.target.value } : r),
                                },
                              })}
                              className="w-full px-2 py-1 border rounded bg-input"
                            />
                          </div>
                          <div>
                            <label className="block text-muted-foreground mb-1">Start Time</label>
                            <select
                              value={row.startMinutes}
                              onChange={e => setDrafts({
                                ...drafts,
                                [prompt.id]: {
                                  ...selection,
                                  rows: selection.rows.map(r => r.id === row.id ? { ...r, startMinutes: parseInt(e.target.value) } : r),
                                },
                              })}
                              className="w-full px-2 py-1 border rounded bg-input"
                            >
                              {timeOptions.map(m => (
                                <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-muted-foreground mb-1">Duration (min)</label>
                            <input
                              type="number"
                              min={15}
                              step={15}
                              value={row.durationMinutes}
                              onChange={e => setDrafts({
                                ...drafts,
                                [prompt.id]: {
                                  ...selection,
                                  rows: selection.rows.map(r => r.id === row.id ? { ...r, durationMinutes: parseInt(e.target.value) || 60 } : r),
                                },
                              })}
                              className="w-full px-2 py-1 border rounded bg-input"
                            />
                          </div>
                          <div className="text-muted-foreground">
                            {placement ? `Week ${placement.week}, ${placement.day.slice(0, 3)}` : 'Select a date'}
                            {(outOfRange || placement?.isWeekend || isOutsideActive) && (
                              <p className="text-amber-500">Outside plan dates</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {wizardError && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {wizardError}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => handleApply(true)}
            className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50"
          >
            Skip for now
          </button>
          <button
            onClick={() => handleApply(false)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Create Anchor Events
          </button>
        </div>
      </div>
    </Modal>
  );
}
