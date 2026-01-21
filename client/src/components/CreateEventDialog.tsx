import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlockTemplate, Day, DAYS, GoldenRuleBucketId, Plan, RecurrencePattern, RecurrenceType, RecurrenceSeries } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { createRecurringBlocks } from '@/lib/recurrence';

export type CreateEventDefaults = {
  title?: string;
  countsTowardGoldenRule?: boolean;
  week?: number;
  day?: Day;
  startMinutes?: number;
  durationMinutes?: number;
  location?: string;
  resource?: string;
  notes?: string;
  isLocked?: boolean;
};

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (block: any, saveAsTemplate?: BlockTemplate | null) => void;
  templates: BlockTemplate[];
  plan: Plan;
  onCreateRecurrence?: (blocks: any[], series: RecurrenceSeries, saveAsTemplate?: BlockTemplate | null) => void;
  initialValues?: CreateEventDefaults;
}

export function CreateEventDialog({ open, onClose, onCreate, templates, plan, onCreateRecurrence, initialValues }: CreateEventDialogProps) {
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('guest_speaker');
  const [organization, setOrganization] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [location, setLocation] = useState('Other');
  const [notes, setNotes] = useState('');
  const [resource, setResource] = useState('Other');
  const [countsTowardGoldenRule, setCountsTowardGoldenRule] = useState(false);
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState<Day>('Monday');
  const [startMinutes, setStartMinutes] = useState(390);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<Day[]>([day]);
  const [recurrenceStartWeek, setRecurrenceStartWeek] = useState(1);
  const [recurrenceEndWeek, setRecurrenceEndWeek] = useState(plan.settings.weeks);

  useEffect(() => {
    if (!open || !initialValues) return;
    setTitle(initialValues.title ?? '');
    setCountsTowardGoldenRule(initialValues.countsTowardGoldenRule ?? false);
    setWeek(initialValues.week ?? 1);
    setDay(initialValues.day ?? 'Monday');
    setStartMinutes(initialValues.startMinutes ?? 390);
    setDurationMinutes(initialValues.durationMinutes ?? 60);
    setLocation(initialValues.location ?? 'Other');
    setResource(initialValues.resource ?? 'Other');
    setNotes(initialValues.notes ?? '');
    setIsLocked(initialValues.isLocked ?? true);
    setRecurrenceType('none');
    setRecurrenceDays([initialValues.day ?? 'Monday']);
    setRecurrenceStartWeek(initialValues.week ?? 1);
    setRecurrenceEndWeek(plan.settings.weeks);
  }, [open, initialValues]);

  useEffect(() => {
    if (!open || initialValues) return;
    setRecurrenceDays([day]);
    setRecurrenceStartWeek(week);
    setRecurrenceEndWeek(plan.settings.weeks);
  }, [open, day, week, plan.settings.weeks, initialValues]);

  const handleCreate = () => {
    if (!title) return;
    const matchResult = resolveTemplateForImportedTitle(title, templates);
    const matchedTemplate = matchResult.templateId ? templates.find(t => t.id === matchResult.templateId) : null;
    const resolvedBucketId = countsTowardGoldenRule
      ? (matchResult.bucketId ?? matchedTemplate?.goldenRuleBucketId ?? null)
      : null;
    const block = {
      id: uuidv4(),
      templateId: matchedTemplate?.id ?? null,
      week,
      day,
      startMinutes,
      durationMinutes,
      titleOverride: title,
      location,
      notes: `${notes}\nContact: ${contactName} ${contactEmail} ${contactPhone}`,
      countsTowardGoldenRule,
      goldenRuleBucketId: resolvedBucketId,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
      resource,
      isLocked,
    };

    let newTemplate: BlockTemplate | null = null;
    if (saveAsTemplate) {
      newTemplate = {
        id: uuidv4(),
        title,
        category: 'Other',
        colorHex: '#6B7280',
        defaultDurationMinutes: durationMinutes,
        countsTowardGoldenRule,
        goldenRuleBucketId: null as GoldenRuleBucketId | null,
        defaultLocation: location,
        defaultNotes: notes,
      };
    }

    if (recurrenceType !== 'none' && onCreateRecurrence) {
      const pattern: RecurrencePattern = {
        type: recurrenceType,
        daysOfWeek: recurrenceType === 'weekly' ? [day] : recurrenceDays,
        startWeek: recurrenceStartWeek,
        endWeek: recurrenceEndWeek,
      };
      if (pattern.type === 'custom' && pattern.daysOfWeek.length === 0) {
        setRecurrenceDays([day]);
        return;
      }
      const { series, blocks } = createRecurringBlocks(block, pattern, plan);
      onCreateRecurrence(blocks, series, newTemplate);
    } else {
      onCreate(block, newTemplate);
    }
    // reset
    setTitle(''); setOrganization(''); setContactName(''); setContactEmail(''); setContactPhone(''); setNotes(''); setSaveAsTemplate(false); setIsLocked(true);
    setRecurrenceType('none'); setRecurrenceDays([day]); setRecurrenceStartWeek(week); setRecurrenceEndWeek(plan.settings.weeks);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">Week</label>
              <Input type="number" value={week} onChange={(e) => setWeek(Number(e.target.value) || 1)} />
            </div>
            <div>
              <label className="text-sm">Day</label>
              <select className="w-full p-2 border rounded" value={day} onChange={(e) => setDay(e.target.value as Day)}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">Start Minutes (e.g. 390 = 6:30)</label>
              <Input type="number" value={startMinutes} onChange={(e) => setStartMinutes(Number(e.target.value) || 390)} />
            </div>
            <div>
              <label className="text-sm">Duration Minutes</label>
              <Input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)} />
            </div>
          </div>

          <div>
            <label className="text-sm">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div>
            <label className="text-sm">Resource</label>
            <Input value={resource} onChange={(e) => setResource(e.target.value)} />
          </div>

          <div>
            <label className="text-sm">Notes / Logistics</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <input id="save-template" type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
            <label htmlFor="save-template" className="text-sm">Save as template</label>
          </div>

          <div className="flex items-center gap-2">
            <input id="counts-gr" type="checkbox" checked={countsTowardGoldenRule} onChange={(e) => setCountsTowardGoldenRule(e.target.checked)} />
            <label htmlFor="counts-gr" className="text-sm">Counts toward Golden Rule</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="lock-placement" type="checkbox" checked={isLocked} onChange={(e) => setIsLocked(e.target.checked)} />
            <label htmlFor="lock-placement" className="text-sm">Lock placement (partner scheduled)</label>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Repeat</label>
              <select
                value={recurrenceType}
                onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="none">No repeat</option>
                <option value="weekly">Weekly (same day)</option>
                <option value="custom">Custom days</option>
              </select>
            </div>

            {recurrenceType !== 'none' && (
              <div className="space-y-2">
                {recurrenceType === 'custom' && (
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(d => (
                      <label key={d} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={recurrenceDays.includes(d)}
                          onChange={e => {
                            if (e.target.checked) {
                              setRecurrenceDays([...recurrenceDays, d]);
                            } else {
                              setRecurrenceDays(recurrenceDays.filter(day => day !== d));
                            }
                          }}
                        />
                        {d.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-muted-foreground mb-1">Start week</label>
                    <input
                      type="number"
                      min={1}
                      max={plan.settings.weeks}
                      value={recurrenceStartWeek}
                      onChange={e => setRecurrenceStartWeek(parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1 border rounded bg-input"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1">End week</label>
                    <input
                      type="number"
                      min={1}
                      max={plan.settings.weeks}
                      value={recurrenceEndWeek}
                      onChange={e => setRecurrenceEndWeek(parseInt(e.target.value) || plan.settings.weeks)}
                      className="w-full px-2 py-1 border rounded bg-input"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This will create events from Week {recurrenceStartWeek} to Week {recurrenceEndWeek}.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} data-testid="create-event-confirm">Create Event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateEventDialog;
