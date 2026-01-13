import { Plan, BlockTemplate, DAYS, GOLDEN_RULE_BUCKETS, PlacedBlock, Day } from '@/state/types';
import { minutesToTimeDisplay, getEndMinutes } from './time';
import { v4 as uuidv4 } from 'uuid';

export function exportToCSV(plan: Plan, templates: BlockTemplate[]): string {
  const headers = [
    'Plan Name',
    'Week',
    'Day',
    'Start Time',
    'End Time',
    'Title',
    'Category',
    'Golden Rule Bucket',
    'Location',
    'Notes',
  ];
  
  const rows: string[][] = [headers];
  
  const sortedBlocks = [...plan.blocks].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const dayIndexA = DAYS.indexOf(a.day);
    const dayIndexB = DAYS.indexOf(b.day);
    if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
    return a.startMinutes - b.startMinutes;
  });
  
  for (const block of sortedBlocks) {
    const template = templates.find(t => t.id === block.templateId);
    const title = block.titleOverride || template?.title || 'Unknown';
    const endMinutes = getEndMinutes(block.startMinutes, block.durationMinutes);
    
    const bucketId = block.goldenRuleBucketId || template?.goldenRuleBucketId;
    const bucket = bucketId ? GOLDEN_RULE_BUCKETS.find(b => b.id === bucketId) : null;
    
    rows.push([
      plan.settings.name,
      block.week.toString(),
      block.day,
      minutesToTimeDisplay(block.startMinutes),
      minutesToTimeDisplay(endMinutes),
      title,
      template?.category || 'Other',
      bucket?.label || '',
      block.location || template?.defaultLocation || '',
      block.notes || template?.defaultNotes || '',
    ]);
  }
  
  return rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function exportToICS(plan: Plan, templates: BlockTemplate[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cohort Schedule Builder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);
  const dayOfWeek = baseDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  baseDate.setDate(baseDate.getDate() + daysUntilMonday);
  
  for (const block of plan.blocks) {
    const template = templates.find(t => t.id === block.templateId);
    const title = block.titleOverride || template?.title || 'Event';
    
    const dayIndex = DAYS.indexOf(block.day);
    const eventDate = new Date(baseDate);
    eventDate.setDate(eventDate.getDate() + (block.week - 1) * 7 + dayIndex);
    
    const startHour = Math.floor(block.startMinutes / 60);
    const startMin = block.startMinutes % 60;
    eventDate.setHours(startHour, startMin, 0, 0);
    
    const endDate = new Date(eventDate);
    endDate.setMinutes(endDate.getMinutes() + block.durationMinutes);
    
    const formatDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${block.id}@cohort-schedule-builder`);
    lines.push(`DTSTAMP:${formatDate(new Date())}`);
    lines.push(`DTSTART:${formatDate(eventDate)}`);
    lines.push(`DTEND:${formatDate(endDate)}`);
    lines.push(`SUMMARY:${title}`);
    if (block.location) {
      lines.push(`LOCATION:${block.location}`);
    }
    if (block.notes) {
      lines.push(`DESCRIPTION:${block.notes.replace(/\n/g, '\\n')}`);
    }
    lines.push('END:VEVENT');
  }
  
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadJSON(content: object, filename: string): void {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

interface ParsedICSEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  location?: string;
  description?: string;
}

function parseICSDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleanStr = dateStr.replace(/[^0-9TZ]/g, '');
  
  if (cleanStr.endsWith('Z')) {
    const year = parseInt(cleanStr.slice(0, 4));
    const month = parseInt(cleanStr.slice(4, 6)) - 1;
    const day = parseInt(cleanStr.slice(6, 8));
    const hour = parseInt(cleanStr.slice(9, 11)) || 0;
    const minute = parseInt(cleanStr.slice(11, 13)) || 0;
    return new Date(Date.UTC(year, month, day, hour, minute));
  }
  
  const year = parseInt(cleanStr.slice(0, 4));
  const month = parseInt(cleanStr.slice(4, 6)) - 1;
  const day = parseInt(cleanStr.slice(6, 8));
  const hour = parseInt(cleanStr.slice(9, 11)) || 0;
  const minute = parseInt(cleanStr.slice(11, 13)) || 0;
  
  return new Date(year, month, day, hour, minute);
}

export function parseICS(content: string): ParsedICSEvent[] {
  const events: ParsedICSEvent[] = [];
  const lines = content.replace(/\r\n /g, '').split(/\r?\n/);
  
  let inEvent = false;
  let currentEvent: Partial<ParsedICSEvent> = {};
  
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }
    
    if (line === 'END:VEVENT') {
      if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
        events.push({
          uid: currentEvent.uid || uuidv4(),
          summary: currentEvent.summary,
          dtstart: currentEvent.dtstart,
          dtend: currentEvent.dtend,
          location: currentEvent.location,
          description: currentEvent.description,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }
    
    if (!inEvent) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).split(';')[0];
    const value = line.slice(colonIndex + 1);
    
    switch (key) {
      case 'UID':
        currentEvent.uid = value;
        break;
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'DTSTART':
        currentEvent.dtstart = parseICSDate(value) || undefined;
        break;
      case 'DTEND':
        currentEvent.dtend = parseICSDate(value) || undefined;
        break;
      case 'LOCATION':
        currentEvent.location = value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = value.replace(/\\n/g, '\n');
        break;
    }
  }
  
  return events;
}

export function importICSToBlocks(
  content: string,
  templates: BlockTemplate[],
  referenceDate: Date = new Date()
): { blocks: PlacedBlock[]; skipped: number } {
  const events = parseICS(content);
  const blocks: PlacedBlock[] = [];
  let skipped = 0;
  
  const refDate = new Date(referenceDate);
  refDate.setHours(0, 0, 0, 0);
  const refDay = refDate.getDay();
  const mondayRef = new Date(refDate);
  mondayRef.setDate(refDate.getDate() - (refDay === 0 ? 6 : refDay - 1));
  
  const defaultTemplate = templates[0];
  if (!defaultTemplate) {
    return { blocks: [], skipped: events.length };
  }
  
  for (const event of events) {
    const eventDate = new Date(event.dtstart);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((eventDate.getTime() - mondayRef.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      skipped++;
      continue;
    }
    
    const week = Math.floor(diffDays / 7) + 1;
    const dayIndex = diffDays % 7;
    
    if (dayIndex > 4) {
      skipped++;
      continue;
    }
    
    const day = DAYS[dayIndex] as Day;
    
    const startHour = event.dtstart.getHours();
    const startMinute = event.dtstart.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    
    const durationMs = event.dtend.getTime() - event.dtstart.getTime();
    const durationMinutes = Math.max(15, Math.round(durationMs / (1000 * 60) / 15) * 15);
    
    if (startMinutes < 390 || startMinutes + durationMinutes > 930) {
      skipped++;
      continue;
    }
    
    const matchingTemplate = templates.find(t => 
      t.title.toLowerCase() === event.summary.toLowerCase()
    ) || defaultTemplate;
    
    blocks.push({
      id: uuidv4(),
      templateId: matchingTemplate.id,
      week,
      day,
      startMinutes,
      durationMinutes,
      titleOverride: matchingTemplate.title === event.summary ? '' : event.summary,
      location: event.location || '',
      notes: event.description || '',
      countsTowardGoldenRule: matchingTemplate.countsTowardGoldenRule,
      goldenRuleBucketId: matchingTemplate.goldenRuleBucketId,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
    });
  }
  
  return { blocks, skipped };
}
