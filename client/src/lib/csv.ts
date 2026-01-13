import { Plan, BlockTemplate, DAYS, GOLDEN_RULE_BUCKETS } from '@/state/types';
import { minutesToTimeDisplay, getEndMinutes } from './time';

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
