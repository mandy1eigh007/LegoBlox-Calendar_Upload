import { useState } from 'react';
import { Modal } from './Modal';
import { Day, DAYS, GoldenRuleBucketId, GOLDEN_RULE_BUCKETS, RESOURCE_TYPES, ResourceType } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

export type CustomEventType = 'apprenticeship_tour' | 'worksite_tour' | 'guest_speaker' | 'contractor_invite';

export interface CustomEventData {
  eventType: CustomEventType;
  organization: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  notes: string;
  resource: ResourceType | 'other';
  resourceOther?: string;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | null;
  week: number;
  day: Day;
  startMinutes: number;
  durationMinutes: number;
  title: string;
}

interface CustomEventBuilderProps {
  open: boolean;
  onClose: () => void;
  onCreate: (event: CustomEventData) => void;
  maxWeeks: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
}

const EVENT_TYPES: { value: CustomEventType; label: string; defaultBucket?: GoldenRuleBucketId }[] = [
  { value: 'apprenticeship_tour', label: 'Apprenticeship Tour', defaultBucket: 'APPRENTICE_TOURS' },
  { value: 'worksite_tour', label: 'Worksite Tour', defaultBucket: 'WORKSITE_TOURS' },
  { value: 'guest_speaker', label: 'Guest Speaker', defaultBucket: 'SPEAKER_PRESENTATIONS' },
  { value: 'contractor_invite', label: 'Contractor Invite' },
];

export function CustomEventBuilder({
  open,
  onClose,
  onCreate,
  maxWeeks,
  dayStartMinutes,
  dayEndMinutes,
}: CustomEventBuilderProps) {
  const [eventType, setEventType] = useState<CustomEventType>('guest_speaker');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [resource, setResource] = useState<ResourceType | 'other'>('other');
  const [resourceOther, setResourceOther] = useState('');
  const [week, setWeek] = useState(1);
  const [day, setDay] = useState<Day>('Monday');
  const [startHour, setStartHour] = useState(8);
  const [startMinute, setStartMinute] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [countsTowardGoldenRule, setCountsTowardGoldenRule] = useState(false);
  const [goldenRuleBucketId, setGoldenRuleBucketId] = useState<GoldenRuleBucketId | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const handleEventTypeChange = (type: CustomEventType) => {
    setEventType(type);
    const eventConfig = EVENT_TYPES.find(e => e.value === type);
    if (eventConfig?.defaultBucket) {
      setGoldenRuleBucketId(eventConfig.defaultBucket);
      setCountsTowardGoldenRule(true);
    } else {
      setGoldenRuleBucketId(null);
      setCountsTowardGoldenRule(false);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert('Please enter a title for the event');
      return;
    }

    const startMinutes = startHour * 60 + startMinute;
    
    if (startMinutes < dayStartMinutes || startMinutes >= dayEndMinutes) {
      alert('Start time must be within day bounds');
      return;
    }

    if (startMinutes + durationMinutes > dayEndMinutes) {
      alert('Event would extend beyond day end time');
      return;
    }

    const eventData: CustomEventData = {
      eventType,
      organization,
      contactName,
      contactEmail,
      contactPhone,
      address,
      notes,
      resource: resource === 'other' ? 'other' : resource,
      resourceOther: resource === 'other' ? resourceOther : undefined,
      countsTowardGoldenRule,
      goldenRuleBucketId,
      week,
      day,
      startMinutes,
      durationMinutes,
      title,
    };

    onCreate(eventData);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setTitle('');
    setOrganization('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAddress('');
    setNotes('');
    setResource('other');
    setResourceOther('');
    setWeek(1);
    setDay('Monday');
    setStartHour(8);
    setStartMinute(0);
    setDurationMinutes(60);
    setSaveAsTemplate(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Custom Event">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Type
          </label>
          <select
            value={eventType}
            onChange={e => handleEventTypeChange(e.target.value as CustomEventType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {EVENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g., Guest Speaker - John Doe"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Company/Union name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Primary contact"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="(555) 123-4567"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address/Location
          </label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="Street address or location details"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes/Logistics
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
            placeholder="PPE requirements, parking, special instructions..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Resource
          </label>
          <select
            value={resource}
            onChange={e => setResource(e.target.value as ResourceType | 'other')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {RESOURCE_TYPES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {resource === 'other' && (
            <input
              type="text"
              value={resourceOther}
              onChange={e => setResourceOther(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2"
              placeholder="Specify resource location"
            />
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Scheduling</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Week
              </label>
              <select
                value={week}
                onChange={e => setWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {Array.from({ length: maxWeeks }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Day
              </label>
              <select
                value={day}
                onChange={e => setDay(e.target.value as Day)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {DAYS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Hour
              </label>
              <input
                type="number"
                value={startHour}
                onChange={e => setStartHour(parseInt(e.target.value))}
                min={0}
                max={23}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Minute
              </label>
              <select
                value={startMinute}
                onChange={e => setStartMinute(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value={0}>00</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={45}>45</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (min)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value))}
                step={15}
                min={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="counts-toward-golden-rule"
              checked={countsTowardGoldenRule}
              onChange={e => setCountsTowardGoldenRule(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="counts-toward-golden-rule" className="text-sm font-medium text-gray-700">
              Counts toward Golden Rule
            </label>
          </div>

          {countsTowardGoldenRule && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Golden Rule Bucket
              </label>
              <select
                value={goldenRuleBucketId || ''}
                onChange={e => setGoldenRuleBucketId(e.target.value as GoldenRuleBucketId)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select a bucket...</option>
                {GOLDEN_RULE_BUCKETS.map(bucket => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="save-as-template"
              checked={saveAsTemplate}
              onChange={e => setSaveAsTemplate(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="save-as-template" className="text-sm font-medium text-gray-700">
              Save as template for future use
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={handleCreate}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Event
        </button>
        <button
          onClick={() => {
            handleReset();
            onClose();
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
