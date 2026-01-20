import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlockTemplate, Day, DAYS, GoldenRuleBucketId } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

interface CreateEventDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (block: any, saveAsTemplate?: BlockTemplate | null) => void;
  templates: BlockTemplate[];
}

export function CreateEventDialog({ open, onClose, onCreate, templates }: CreateEventDialogProps) {
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

  const handleCreate = () => {
    if (!title) return;
    const block = {
      id: uuidv4(),
      templateId: null as string | null,
      week,
      day,
      startMinutes,
      durationMinutes,
      titleOverride: title,
      location,
      notes: `${notes}\nContact: ${contactName} ${contactEmail} ${contactPhone}`,
      countsTowardGoldenRule,
      goldenRuleBucketId: countsTowardGoldenRule ? (templates.find(t => t.title === title)?.goldenRuleBucketId ?? null) : null,
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

    onCreate(block, newTemplate);
    // reset
    setTitle(''); setOrganization(''); setContactName(''); setContactEmail(''); setContactPhone(''); setNotes(''); setSaveAsTemplate(false); setIsLocked(true);
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
