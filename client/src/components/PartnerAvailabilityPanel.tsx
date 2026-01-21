import { useMemo, useState } from 'react';
import { BlockTemplate, Day, DAYS, Plan, PlacedBlock, PartnerRequestRef } from '@/state/types';
import { minutesToTimeDisplay } from '@/lib/time';
import { getDateForWeekDay, getWeekDayFromDate } from '@/lib/dateMapping';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from './Modal';

type AvailabilitySlot = {
  id: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  title: string;
};

type PartnerResponse = {
  id: string;
  slotId: string;
  name: string;
  org: string;
  email: string;
  phone: string;
  notes: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
};

interface PartnerAvailabilityPanelProps {
  open: boolean;
  plan: Plan;
  templates: BlockTemplate[];
  currentWeek: number;
  onClose: () => void;
  onUpdatePlan: (plan: Plan) => void;
  onAddBlock: (block: PlacedBlock) => void;
}

export function PartnerAvailabilityPanel({
  open,
  plan,
  templates,
  currentWeek,
  onClose,
  onUpdatePlan,
  onAddBlock,
}: PartnerAvailabilityPanelProps) {
  const [requestLabel, setRequestLabel] = useState('Partner Availability');
  const [code, setCode] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<PartnerResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const activeDays = plan.settings.activeDays?.length ? plan.settings.activeDays : DAYS;

  const timeOptions: number[] = [];
  for (let m = plan.settings.dayStartMinutes; m <= plan.settings.dayEndMinutes; m += 15) {
    timeOptions.push(m);
  }

  const openSlots = useMemo(() => {
    const slotsByDay: { day: Day; startMinutes: number; endMinutes: number }[] = [];
    for (const day of activeDays) {
      const dayBlocks = plan.blocks
        .filter(b => b.week === currentWeek && b.day === day)
        .sort((a, b) => a.startMinutes - b.startMinutes);
      let current = plan.settings.dayStartMinutes;
      for (const block of dayBlocks) {
        if (current < block.startMinutes) {
          slotsByDay.push({ day, startMinutes: current, endMinutes: block.startMinutes });
        }
        current = Math.max(current, block.startMinutes + block.durationMinutes);
      }
      if (current < plan.settings.dayEndMinutes) {
        slotsByDay.push({ day, startMinutes: current, endMinutes: plan.settings.dayEndMinutes });
      }
    }
    return slotsByDay.filter(slot => slot.endMinutes - slot.startMinutes >= 30);
  }, [plan.blocks, plan.settings.dayEndMinutes, plan.settings.dayStartMinutes, activeDays, currentWeek]);

  const handleAddSlot = () => {
    setSlots(prev => [
      ...prev,
      {
        id: uuidv4(),
        date: plan.settings.startDate || '',
        startMinutes: plan.settings.dayStartMinutes,
        durationMinutes: 60,
        title: requestLabel,
      },
    ]);
  };

  const handleAddOpenSlot = (day: Day, startMinutes: number, endMinutes: number) => {
    const date = plan.settings.startDate
      ? getDateForWeekDay(plan.settings.startDate, currentWeek, day)
      : null;
    if (!date) {
      setError('Set a cohort start date to use open slots.');
      return;
    }
    setSlots(prev => [
      ...prev,
      {
        id: uuidv4(),
        date,
        startMinutes,
        durationMinutes: Math.min(120, endMinutes - startMinutes),
        title: requestLabel,
      },
    ]);
  };

  const generateCode = () => {
    const next = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(next);
  };

  const handleCreateRequest = async () => {
    setError(null);
    const filtered = slots.filter(s => s.date && s.durationMinutes > 0);
    if (!code) {
      setError('Access code is required.');
      return;
    }
    if (filtered.length === 0) {
      setError('Add at least one availability slot.');
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/partner-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          planName: plan.settings.name,
          code,
          slots: filtered,
        }),
      });
      if (!res.ok) {
        setError('Failed to create link.');
        return;
      }
      const json = await res.json();
      setRequestId(json.id);

      const nextRequests: PartnerRequestRef[] = [
        ...(plan.settings.partnerRequests || []),
        { id: json.id, code, label: requestLabel, createdAt: json.createdAt },
      ];
      onUpdatePlan({
        ...plan,
        settings: { ...plan.settings, partnerRequests: nextRequests },
      });
    } catch {
      setError('Failed to create link.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadResponses = async (id: string, accessCode: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/partner-availability/${id}/responses?code=${encodeURIComponent(accessCode)}`);
      if (!res.ok) {
        setError('Failed to load responses.');
        return;
      }
      const json = await res.json();
      setResponses(json.responses || []);
    } catch {
      setError('Failed to load responses.');
    } finally {
      setLoading(false);
    }
  };

  const approveResponse = async (request: PartnerRequestRef, responseId: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/partner-availability/${request.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: request.code, responseId }),
      });
      if (!res.ok) {
        setError('Approval failed.');
        return;
      }
      const json = await res.json();
      const slot = json.slot as AvailabilitySlot | undefined;
      const response = json.response as PartnerResponse | undefined;
      if (slot && response) {
        const placement = getWeekDayFromDate(slot.date, plan.settings.startDate);
        if (!placement || placement.isWeekend) {
          setError('Selected date is outside the calendar.');
          return;
        }
        const match = resolveTemplateForImportedTitle(slot.title || request.label, templates);
        const matchedTemplate = match.templateId ? templates.find(t => t.id === match.templateId) : null;
        const block: PlacedBlock = {
          id: uuidv4(),
          templateId: matchedTemplate?.id ?? null,
          week: placement.week,
          day: placement.day,
          startMinutes: slot.startMinutes,
          durationMinutes: slot.durationMinutes,
          titleOverride: slot.title || request.label,
          location: matchedTemplate?.defaultLocation ?? '',
          notes: `Partner: ${response.name}\nOrg: ${response.org}\nEmail: ${response.email}\nPhone: ${response.phone}\nNotes: ${response.notes}`,
          countsTowardGoldenRule: !!match.bucketId,
          goldenRuleBucketId: match.bucketId ?? matchedTemplate?.goldenRuleBucketId ?? null,
          recurrenceSeriesId: null,
          isRecurrenceException: false,
          resource: matchedTemplate?.defaultResource || undefined,
          isLocked: true,
          isAfterHours: false,
        };
        onAddBlock(block);
      }
      await handleLoadResponses(request.id, request.code);
    } catch {
      setError('Approval failed.');
    } finally {
      setLoading(false);
    }
  };

  const partnerLink = requestId
    ? `${window.location.origin}/partner/${requestId}?code=${encodeURIComponent(code)}`
    : '';

  return (
    <Modal open={open} onClose={onClose} title="Partner Availability Link">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Request label</label>
          <input
            value={requestLabel}
            onChange={e => setRequestLabel(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded bg-input"
          />
        </div>

        <div className="flex gap-2 items-center">
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Access code"
            className="flex-1 px-3 py-2 border border-border rounded bg-input"
          />
          <button onClick={generateCode} className="px-3 py-2 text-sm border rounded">Generate</button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Availability slots</p>
            <button onClick={handleAddSlot} className="text-xs text-accent underline">Add slot</button>
          </div>
          <div className="space-y-2">
            {slots.map(slot => (
              <div key={slot.id} className="grid grid-cols-2 gap-2 text-xs border border-border rounded p-2">
                <div>
                  <label className="block text-muted-foreground mb-1">Date</label>
                  <input
                    type="date"
                    value={slot.date}
                    onChange={e => setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, date: e.target.value } : s))}
                    className="w-full px-2 py-1 border rounded bg-input"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Title</label>
                  <input
                    value={slot.title}
                    onChange={e => setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, title: e.target.value } : s))}
                    className="w-full px-2 py-1 border rounded bg-input"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Start Time</label>
                  <select
                    value={slot.startMinutes}
                    onChange={e => setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, startMinutes: parseInt(e.target.value) } : s))}
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
                    value={slot.durationMinutes}
                    onChange={e => setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, durationMinutes: parseInt(e.target.value) || 30 } : s))}
                    className="w-full px-2 py-1 border rounded bg-input"
                  />
                </div>
                <button
                  onClick={() => setSlots(prev => prev.filter(s => s.id !== slot.id))}
                  className="text-xs text-red-400"
                >
                  Remove slot
                </button>
              </div>
            ))}
          </div>
        </div>

        {openSlots.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Quick add from current week openings</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {openSlots.map((slot, index) => (
                <button
                  key={`${slot.day}-${slot.startMinutes}-${index}`}
                  onClick={() => handleAddOpenSlot(slot.day, slot.startMinutes, slot.endMinutes)}
                  className="px-2 py-1 border border-border rounded hover:bg-secondary/50 text-left"
                >
                  {slot.day.slice(0, 3)} {minutesToTimeDisplay(slot.startMinutes)}–{minutesToTimeDisplay(slot.endMinutes)}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
            {error}
          </div>
        )}

        {partnerLink && (
          <div className="text-xs text-muted-foreground border border-border rounded p-2">
            Share this link with partners:
            <div className="mt-1 break-all text-foreground">{partnerLink}</div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={handleCreateRequest} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90">
            {loading ? 'Saving...' : 'Create Partner Link'}
          </button>
        </div>

        {(plan.settings.partnerRequests || []).length > 0 && (
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-sm font-medium">Pending partner responses</p>
            {(plan.settings.partnerRequests || []).map(request => (
              <div key={request.id} className="border border-border rounded p-2 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{request.label}</p>
                    <p className="text-muted-foreground">Code: {request.code}</p>
                  </div>
                  <button
                    onClick={() => handleLoadResponses(request.id, request.code)}
                    className="px-2 py-1 border border-border rounded"
                  >
                    Load responses
                  </button>
                </div>
                {responses.length > 0 && (
                  <div className="space-y-2">
                    {responses.filter(r => r.status === 'pending').map(response => (
                      <div key={response.id} className="border border-border rounded p-2">
                        <p className="font-medium">{response.name} ({response.org})</p>
                        <p className="text-muted-foreground">{response.email} • {response.phone}</p>
                        {response.notes && <p className="text-muted-foreground">Notes: {response.notes}</p>}
                        <button
                          onClick={() => approveResponse(request, response.id)}
                          className="mt-1 px-2 py-1 text-xs bg-green-600 text-white rounded"
                        >
                          Approve & add event
                        </button>
                      </div>
                    ))}
                    {responses.filter(r => r.status === 'pending').length === 0 && (
                      <p className="text-xs text-muted-foreground">No pending responses.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
