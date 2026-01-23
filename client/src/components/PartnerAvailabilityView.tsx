import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { minutesToTimeDisplay } from '@/lib/time';

type PartnerSlot = {
  id: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  title?: string;
};

export function PartnerAvailabilityView() {
  const { requestId } = useParams<{ requestId: string }>();
  const [code, setCode] = useState('');
  const [requestName, setRequestName] = useState('');
  const [slots, setSlots] = useState<PartnerSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const existingCode = params.get('code') || '';
    if (existingCode) {
      setCode(existingCode);
    }
  }, []);

  const loadRequest = async (accessCode: string) => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner-availability/${requestId}?code=${encodeURIComponent(accessCode)}`);
      if (!res.ok) {
        setError('Invalid access code.');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setRequestName(json.planName || 'Partner Availability');
      setSlots(json.slots || []);
      if (json.slots && json.slots.length > 0) {
        setSelectedSlot(json.slots[0].id);
      }
    } catch {
      setError('Failed to load availability.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!requestId) return;
    if (!selectedSlot || !name || !org || !email || !phone) {
      setError('Please complete all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner-availability/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          slotId: selectedSlot,
          name,
          org,
          email,
          phone,
          notes,
        }),
      });
      if (!res.ok) {
        setError('Failed to submit. Check the code and try again.');
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError('Failed to submit.');
    } finally {
      setLoading(false);
    }
  };

  if (!requestId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Invalid link.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">{requestName || 'Partner Availability'}</h1>
        <p className="text-sm text-muted-foreground">
          Select a time that works for you. Your request will be confirmed after approval.
        </p>

        <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20">
          <label className="block text-sm font-medium">Access Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="flex-1 px-3 py-2 border border-border rounded bg-input"
            />
            <button
              onClick={() => loadRequest(code)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Load Slots
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 rounded p-3">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {slots.length > 0 && !success && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Available times</label>
              <div className="space-y-2">
                {slots.map(slot => (
                  <label key={slot.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      checked={selectedSlot === slot.id}
                      onChange={() => setSelectedSlot(slot.id)}
                    />
                    <div>
                      <div className="font-medium">
                        {slot.date} • {minutesToTimeDisplay(slot.startMinutes)} ({slot.durationMinutes} min)
                      </div>
                      {slot.title && <div className="text-xs text-muted-foreground">{slot.title}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-border rounded bg-input" />
              </div>
              <div>
                <label className="block text-sm mb-1">Organization</label>
                <input value={org} onChange={e => setOrg(e.target.value)} className="w-full px-3 py-2 border border-border rounded bg-input" />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 border border-border rounded bg-input" />
              </div>
              <div>
                <label className="block text-sm mb-1">Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border border-border rounded bg-input" />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border border-border rounded bg-input" />
            </div>

            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-accent text-accent-foreground rounded hover:opacity-90"
            >
              Submit Selection
            </button>
          </div>
        )}

        {success && (
          <div className="border border-green-500/20 bg-green-500/10 rounded-lg p-4 text-sm text-green-300">
            Thank you! Your selection was submitted and is pending approval.
          </div>
        )}
      </div>
    </div>
  );
}
