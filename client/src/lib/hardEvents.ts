import { Day, DAYS, PlacedBlock, GoldenRuleBucketId } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

export interface HardEvent {
  id: string;
  cohortId: string;
  startDate: string;
  startTime: string;
  endTime: string;
  title: string;
  templateId: string | null;
  resourceId: string;
  locked: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

export interface HardEventsConfig {
  events: HardEvent[];
  version: number;
}

const STORAGE_KEY = 'cohort-schedule-hard-events';

export function loadHardEvents(): HardEventsConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load hard events');
  }
  return { events: [], version: 1 };
}

export function saveHardEvents(config: HardEventsConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function parseHardEventsCSV(csvContent: string): HardEvent[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const events: HardEvent[] = [];
  
  if (lines.length < 2) return [];
  
  const headerLine = lines[0].toLowerCase();
  if (!headerLine.includes('start_date') && !headerLine.includes('startdate')) {
    return [];
  }
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    
    if (parts.length >= 4) {
      events.push({
        id: uuidv4(),
        cohortId: parts[0] || '',
        startDate: parts[1] || '',
        startTime: parts[2] || '',
        endTime: parts[3] || '',
        title: parts[4] || '',
        templateId: parts[5] || null,
        resourceId: parts[6] || 'ANY',
        locked: parts[7]?.toLowerCase() === 'true',
        contactName: parts[8] || '',
        contactPhone: parts[9] || '',
        contactEmail: parts[10] || '',
        notes: parts[11] || '',
      });
    }
  }
  
  return events;
}

export function importHardEventsCSV(csvContent: string): number {
  const newEvents = parseHardEventsCSV(csvContent);
  if (newEvents.length === 0) return 0;
  
  const config = loadHardEvents();
  config.events.push(...newEvents);
  saveHardEvents(config);
  return newEvents.length;
}

export function exportHardEventsCSV(): string {
  const config = loadHardEvents();
  const lines = [
    'cohort_id,start_date,start_time,end_time,title,template_id,resource_id,locked,contact_name,contact_phone,contact_email,notes'
  ];
  
  for (const event of config.events) {
    lines.push([
      event.cohortId,
      event.startDate,
      event.startTime,
      event.endTime,
      event.title,
      event.templateId || '',
      event.resourceId,
      event.locked ? 'true' : 'false',
      event.contactName,
      event.contactPhone,
      event.contactEmail,
      event.notes,
    ].map(v => `"${v}"`).join(','));
  }
  
  return lines.join('\n');
}

export function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function convertHardEventToBlock(
  event: HardEvent,
  weekNumber: number,
  dayOfWeek: Day
): PlacedBlock {
  const startMinutes = timeStringToMinutes(event.startTime);
  const endMinutes = timeStringToMinutes(event.endTime);
  const durationMinutes = Math.max(15, endMinutes - startMinutes);
  
  return {
    id: uuidv4(),
    templateId: event.templateId,
    week: weekNumber,
    day: dayOfWeek,
    startMinutes,
    durationMinutes,
    titleOverride: event.title,
    location: '',
    notes: event.notes,
    countsTowardGoldenRule: !!event.templateId,
    goldenRuleBucketId: null,
    recurrenceSeriesId: null,
    isRecurrenceException: false,
    resource: event.resourceId,
  };
}

export function getHardEventsForCohort(cohortId: string): HardEvent[] {
  const config = loadHardEvents();
  return config.events.filter(e => e.cohortId === cohortId || e.cohortId === '');
}

export function clearHardEventsForCohort(cohortId: string): void {
  const config = loadHardEvents();
  config.events = config.events.filter(e => e.cohortId !== cohortId);
  saveHardEvents(config);
}

export function deleteHardEvent(eventId: string): void {
  const config = loadHardEvents();
  config.events = config.events.filter(e => e.id !== eventId);
  saveHardEvents(config);
}
