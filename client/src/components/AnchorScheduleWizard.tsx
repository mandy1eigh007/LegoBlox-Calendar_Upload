import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { BlockTemplate, Day, DAYS, Plan, AnchorPromptId, AnchorEventDraft, PlacedBlock } from '@/state/types';
import { ANCHOR_PROMPTS, AnchorScheduleSelection, buildAnchorBlock, buildAnchorDraft, createAnchorSelections } from '@/lib/anchorPrompts';
import { minutesToTimeDisplay } from '@/lib/time';

interface AnchorScheduleWizardProps {
  open: boolean;
  plan: Plan;
  templates: BlockTemplate[];
  onClose: () => void;
  onApply: (updates: { anchorSchedule: Partial<Record<AnchorPromptId, AnchorEventDraft>>; blocks: PlacedBlock[]; dismiss?: boolean }) => void;
}

export function AnchorScheduleWizard({ open, plan, templates, onClose, onApply }: AnchorScheduleWizardProps) {
  const selectedAnchors = useMemo(
    () => ANCHOR_PROMPTS.filter(prompt => plan.settings.anchorChecklist?.[prompt.id]),
    [plan.settings.anchorChecklist]
  );

  const [drafts, setDrafts] = useState<Record<AnchorPromptId, AnchorScheduleSelection>>(
    createAnchorSelections(plan.settings.dayStartMinutes)
  );

  useEffect(() => {
    if (!open) return;
    const base = createAnchorSelections(plan.settings.dayStartMinutes);
    for (const prompt of ANCHOR_PROMPTS) {
      if (!plan.settings.anchorChecklist?.[prompt.id]) continue;
      const existing = plan.settings.anchorSchedule?.[prompt.id];
      base[prompt.id] = {
        ...base[prompt.id],
        enabled: true,
        createNow: existing?.created ? false : true,
        week: existing?.week ?? base[prompt.id].week,
        day: existing?.day ?? base[prompt.id].day,
        startMinutes: existing?.startMinutes ?? base[prompt.id].startMinutes,
        durationMinutes: existing?.durationMinutes ?? base[prompt.id].durationMinutes,
      };
    }
    setDrafts(base);
  }, [open, plan.settings.anchorChecklist, plan.settings.anchorSchedule, plan.settings.dayStartMinutes]);

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
    const anchorSchedule: Partial<Record<AnchorPromptId, AnchorEventDraft>> = {
      ...(plan.settings.anchorSchedule || {}),
    };
    const blocks: PlacedBlock[] = [];

    for (const prompt of selectedAnchors) {
      const selection = drafts[prompt.id];
      if (!selection?.enabled) continue;
      const existing = plan.settings.anchorSchedule?.[prompt.id];
      const alreadyCreated = !!existing?.created;
      const draft = buildAnchorDraft(prompt, selection);
      draft.created = alreadyCreated || selection.createNow;
      anchorSchedule[prompt.id] = draft;
      if (selection.createNow && !alreadyCreated) {
        blocks.push(buildAnchorBlock(draft, templates));
      }
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
            const existing = plan.settings.anchorSchedule?.[prompt.id];
            const alreadyCreated = !!existing?.created;
            return (
              <div key={prompt.id} className="rounded border border-border p-3 bg-secondary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{prompt.defaultTitle}</p>
                  {alreadyCreated ? (
                    <span className="text-xs text-green-600">Already added</span>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selection.createNow}
                        onChange={e => setDrafts({
                          ...drafts,
                          [prompt.id]: { ...selection, createNow: e.target.checked },
                        })}
                      />
                      Create now
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-muted-foreground mb-1">Week</label>
                    <input
                      type="number"
                      min={1}
                      max={plan.settings.weeks}
                      value={selection.week}
                      onChange={e => setDrafts({
                        ...drafts,
                        [prompt.id]: { ...selection, week: parseInt(e.target.value) || 1 },
                      })}
                      className="w-full px-2 py-1 border rounded bg-input"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Day</label>
                    <select
                      value={selection.day}
                      onChange={e => setDrafts({
                        ...drafts,
                        [prompt.id]: { ...selection, day: e.target.value as Day },
                      })}
                      className="w-full px-2 py-1 border rounded bg-input"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">Start Time</label>
                    <select
                      value={selection.startMinutes}
                      onChange={e => setDrafts({
                        ...drafts,
                        [prompt.id]: { ...selection, startMinutes: parseInt(e.target.value) },
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
                      value={selection.durationMinutes}
                      onChange={e => setDrafts({
                        ...drafts,
                        [prompt.id]: { ...selection, durationMinutes: parseInt(e.target.value) || 60 },
                      })}
                      className="w-full px-2 py-1 border rounded bg-input"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
