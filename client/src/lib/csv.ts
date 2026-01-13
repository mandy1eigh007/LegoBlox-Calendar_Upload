import { Plan, BlockTemplate, DAYS, GOLDEN_RULE_BUCKETS, PlacedBlock, Day } from '@/state/types';
import { minutesToTimeDisplay, getEndMinutes } from './time';
import { v4 as uuidv4 } from 'uuid';
import { resolveTemplateForImportedTitle } from './templateMatcher';

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
  originalTimezone?: string;
  isUTC?: boolean;
}

function parseICSDate(dateStr: string, tzid?: string): { date: Date | null; isUTC: boolean; tzid?: string } {
  if (!dateStr) return { date: null, isUTC: false };
  
  const cleanStr = dateStr.replace(/[^0-9TZ]/g, '');
  
  if (cleanStr.endsWith('Z')) {
    const year = parseInt(cleanStr.slice(0, 4));
    const month = parseInt(cleanStr.slice(4, 6)) - 1;
    const day = parseInt(cleanStr.slice(6, 8));
    const hour = parseInt(cleanStr.slice(9, 11)) || 0;
    const minute = parseInt(cleanStr.slice(11, 13)) || 0;
    return { date: new Date(Date.UTC(year, month, day, hour, minute)), isUTC: true, tzid: 'UTC' };
  }
  
  const year = parseInt(cleanStr.slice(0, 4));
  const month = parseInt(cleanStr.slice(4, 6)) - 1;
  const day = parseInt(cleanStr.slice(6, 8));
  const hour = parseInt(cleanStr.slice(9, 11)) || 0;
  const minute = parseInt(cleanStr.slice(11, 13)) || 0;
  
  return { date: new Date(year, month, day, hour, minute), isUTC: false, tzid };
}

export function parseICS(content: string): { events: ParsedICSEvent[]; detectedTimezone: string | null } {
  const events: ParsedICSEvent[] = [];
  const lines = content.replace(/\r\n /g, '').split(/\r?\n/);
  
  let inEvent = false;
  let currentEvent: Partial<ParsedICSEvent> & { startTzid?: string } = {};
  let detectedTimezone: string | null = null;
  
  for (const line of lines) {
    if (line.startsWith('X-WR-TIMEZONE:') || line.startsWith('TZID:')) {
      const tz = line.split(':')[1]?.trim();
      if (tz && !detectedTimezone) detectedTimezone = tz;
    }
    
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
          originalTimezone: currentEvent.startTzid || detectedTimezone || undefined,
          isUTC: currentEvent.isUTC,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }
    
    if (!inEvent) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const keyPart = line.slice(0, colonIndex);
    const key = keyPart.split(';')[0];
    const value = line.slice(colonIndex + 1);
    
    const tzidMatch = keyPart.match(/TZID=([^;:]+)/);
    const tzid = tzidMatch ? tzidMatch[1] : undefined;
    
    switch (key) {
      case 'UID':
        currentEvent.uid = value;
        break;
      case 'SUMMARY':
        currentEvent.summary = value;
        break;
      case 'DTSTART': {
        const parsed = parseICSDate(value, tzid);
        currentEvent.dtstart = parsed.date || undefined;
        currentEvent.isUTC = parsed.isUTC;
        currentEvent.startTzid = parsed.tzid || tzid;
        break;
      }
      case 'DTEND': {
        const parsed = parseICSDate(value, tzid);
        currentEvent.dtend = parsed.date || undefined;
        break;
      }
      case 'LOCATION':
        currentEvent.location = value;
        break;
      case 'DESCRIPTION':
        currentEvent.description = value.replace(/\\n/g, '\n');
        break;
    }
  }
  
  return { events, detectedTimezone };
}

export interface ICSEventWithDate extends ParsedICSEvent {
  localDateStr: string;
  startMinutesOriginal: number;
  startMinutesRounded: number;
  durationMinutesOriginal: number;
  durationMinutesRounded: number;
  wasRounded: boolean;
  roundingNote: string;
  isOutsideScheduleHours: boolean;
  isWeekend: boolean;
  resource?: string;
  goldenRuleBucketId?: string;
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function roundToNearest15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function formatTime12(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function parseICSWithDateRange(content: string): {
  events: ICSEventWithDate[];
  minDate: Date | null;
  maxDate: Date | null;
  minDateStr: string;
  maxDateStr: string;
  detectedTimezone: string | null;
} {
  const { events: rawEvents, detectedTimezone } = parseICS(content);
  
  const events: ICSEventWithDate[] = rawEvents.map(e => {
    const startMinutesOriginal = e.dtstart.getHours() * 60 + e.dtstart.getMinutes();
    const endMinutesOriginal = e.dtend.getHours() * 60 + e.dtend.getMinutes();
    const durationMinutesOriginal = endMinutesOriginal - startMinutesOriginal;
    
    const startMinutesRounded = roundToNearest15(startMinutesOriginal);
    const durationMinutesRounded = Math.max(15, roundToNearest15(durationMinutesOriginal));
    
    const wasRounded = startMinutesOriginal !== startMinutesRounded || durationMinutesOriginal !== durationMinutesRounded;
    
    let roundingNote = '';
    if (wasRounded) {
      const originalStart = formatTime12(startMinutesOriginal);
      const originalEnd = formatTime12(startMinutesOriginal + durationMinutesOriginal);
      const roundedStart = formatTime12(startMinutesRounded);
      const roundedEnd = formatTime12(startMinutesRounded + durationMinutesRounded);
      roundingNote = `Rounded from ${originalStart}-${originalEnd} to ${roundedStart}-${roundedEnd}`;
    }
    
    const isOutsideScheduleHours = startMinutesRounded < 390 || (startMinutesRounded + durationMinutesRounded) > 930;
    const dayOfWeek = e.dtstart.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    return {
      ...e,
      localDateStr: formatLocalDate(e.dtstart),
      startMinutesOriginal,
      startMinutesRounded,
      durationMinutesOriginal,
      durationMinutesRounded,
      wasRounded,
      roundingNote,
      isOutsideScheduleHours,
      isWeekend,
    };
  });
  
  if (events.length === 0) {
    return { events, minDate: null, maxDate: null, minDateStr: '', maxDateStr: '', detectedTimezone };
  }
  
  const sorted = [...events].sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime());
  return {
    events,
    minDate: sorted[0].dtstart,
    maxDate: sorted[sorted.length - 1].dtstart,
    minDateStr: formatLocalDate(sorted[0].dtstart),
    maxDateStr: formatLocalDate(sorted[sorted.length - 1].dtstart),
    detectedTimezone,
  };
}

export function convertICSEventsToBlocks(
  events: ICSEventWithDate[],
  templates: BlockTemplate[],
  startDate: Date,
  endDate: Date,
  includeOutsideHours: boolean = false
): { blocks: PlacedBlock[]; skipped: number; included: number } {
  const blocks: PlacedBlock[] = [];
  let skipped = 0;
  let included = 0;
  
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  const startDay = start.getDay();
  const mondayRef = new Date(start);
  mondayRef.setDate(start.getDate() - (startDay === 0 ? 6 : startDay - 1));
  
  let minWeek = Infinity;
  const tempBlocks: Array<{event: ICSEventWithDate; week: number; dayIndex: number; diffDays: number}> = [];
  
  for (const event of events) {
    const eventDate = new Date(event.dtstart);
    
    if (eventDate < start || eventDate > end) {
      skipped++;
      continue;
    }
    
    const eventDateOnly = new Date(eventDate);
    eventDateOnly.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((eventDateOnly.getTime() - mondayRef.getTime()) / (1000 * 60 * 60 * 24));
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
    
    minWeek = Math.min(minWeek, week);
    tempBlocks.push({ event, week, dayIndex, diffDays });
  }
  
  for (const { event, week, dayIndex } of tempBlocks) {
    const normalizedWeek = week - minWeek + 1;
    const day = DAYS[dayIndex] as Day;
    
    const startHour = event.dtstart.getHours();
    const startMinute = event.dtstart.getMinutes();
    let startMinutes = startHour * 60 + startMinute;
    
    const durationMs = event.dtend.getTime() - event.dtstart.getTime();
    let durationMinutes = Math.max(15, Math.round(durationMs / (1000 * 60) / 15) * 15);
    
    const isOutsideHours = startMinutes < 390 || startMinutes + durationMinutes > 930;
    if (isOutsideHours && !includeOutsideHours) {
      skipped++;
      continue;
    }
    
    if (isOutsideHours && includeOutsideHours) {
      if (startMinutes < 390) startMinutes = 390;
      if (startMinutes + durationMinutes > 930) {
        durationMinutes = 930 - startMinutes;
      }
      if (durationMinutes < 15) durationMinutes = 15;
    }
    
    const matchResult = resolveTemplateForImportedTitle(event.summary, templates);
    const matchedTemplate = matchResult.templateId ? templates.find(t => t.id === matchResult.templateId) : null;
    
    blocks.push({
      id: uuidv4(),
      templateId: matchResult.templateId,
      week: normalizedWeek,
      day,
      startMinutes,
      durationMinutes,
      titleOverride: event.summary,
      location: event.location || '',
      notes: event.description || '',
      countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
      goldenRuleBucketId: matchedTemplate ? (event.goldenRuleBucketId || matchedTemplate.goldenRuleBucketId) : null,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
      resource: event.resource,
    });
    included++;
  }
  
  return { blocks, skipped, included };
}

export function importICSToBlocks(
  content: string,
  templates: BlockTemplate[],
  referenceDate: Date = new Date()
): { blocks: PlacedBlock[]; skipped: number } {
  const { events } = parseICS(content);
  const blocks: PlacedBlock[] = [];
  let skipped = 0;
  
  const refDate = new Date(referenceDate);
  refDate.setHours(0, 0, 0, 0);
  const refDay = refDate.getDay();
  const mondayRef = new Date(refDate);
  mondayRef.setDate(refDate.getDate() - (refDay === 0 ? 6 : refDay - 1));
  
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
    
    const matchResult = resolveTemplateForImportedTitle(event.summary, templates);
    const matchedTemplate = matchResult.templateId ? templates.find(t => t.id === matchResult.templateId) : null;
    
    blocks.push({
      id: uuidv4(),
      templateId: matchResult.templateId,
      week,
      day,
      startMinutes,
      durationMinutes,
      titleOverride: event.summary,
      location: event.location || '',
      notes: event.description || '',
      countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
      goldenRuleBucketId: matchedTemplate ? matchedTemplate.goldenRuleBucketId : null,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
    });
  }
  
  return { blocks, skipped };
}

export interface CSVDraftEvent {
  id: string;
  week: number;
  day: Day;
  startMinutes: number;
  durationMinutes: number;
  title: string;
  location: string;
  notes: string;
  needsReview: boolean;
  warning?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseTimeString(time: string): number | null {
  const cleanTime = time.trim().toUpperCase();
  
  const match12 = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2]);
    const period = match12[3];
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const minutes = parseInt(match24[2]);
    return hours * 60 + minutes;
  }
  
  return null;
}

function parseDayString(day: string): Day | null {
  const cleanDay = day.trim().toLowerCase();
  const dayMap: Record<string, Day> = {
    'monday': 'Monday', 'mon': 'Monday', 'm': 'Monday',
    'tuesday': 'Tuesday', 'tue': 'Tuesday', 'tu': 'Tuesday',
    'wednesday': 'Wednesday', 'wed': 'Wednesday', 'w': 'Wednesday',
    'thursday': 'Thursday', 'thu': 'Thursday', 'th': 'Thursday',
    'friday': 'Friday', 'fri': 'Friday', 'f': 'Friday',
  };
  return dayMap[cleanDay] || null;
}

export function importCSVToBlocks(
  content: string,
  columnMapping: { week: number; day: number; startTime: number; endTime: number; title: number; location: number; notes: number }
): { drafts: CSVDraftEvent[]; errors: string[] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return { drafts: [], errors: ['CSV file must have a header row and at least one data row'] };
  }
  
  const drafts: CSVDraftEvent[] = [];
  const errors: string[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    
    const weekStr = cells[columnMapping.week] || '1';
    const week = parseInt(weekStr) || 1;
    
    const dayStr = cells[columnMapping.day] || '';
    const day = parseDayString(dayStr);
    
    const startTimeStr = cells[columnMapping.startTime] || '';
    const startMinutes = parseTimeString(startTimeStr);
    
    const endTimeStr = cells[columnMapping.endTime] || '';
    const endMinutes = parseTimeString(endTimeStr);
    
    const title = columnMapping.title >= 0 && columnMapping.title < cells.length ? (cells[columnMapping.title] || '') : '';
    const location = columnMapping.location >= 0 && columnMapping.location < cells.length ? (cells[columnMapping.location] || '') : '';
    const notes = columnMapping.notes >= 0 && columnMapping.notes < cells.length ? (cells[columnMapping.notes] || '') : '';
    
    if (!title) continue;
    
    let needsReview = false;
    let warning = '';
    
    if (!day) {
      needsReview = true;
      warning = `Unknown day: "${dayStr}"`;
    }
    
    if (startMinutes === null || endMinutes === null) {
      needsReview = true;
      warning = warning ? `${warning}; Invalid time format` : 'Invalid time format';
    }
    
    const finalStart = startMinutes ?? 390;
    let finalDuration = (endMinutes !== null && startMinutes !== null) 
      ? endMinutes - startMinutes 
      : 60;
    
    if (finalDuration % 15 !== 0) {
      finalDuration = Math.ceil(finalDuration / 15) * 15;
      warning = warning ? `${warning}; Duration rounded to 15-min` : 'Duration rounded to 15-min increment';
    }
    
    if (finalStart < 390 || finalStart + finalDuration > 930) {
      needsReview = true;
      warning = warning ? `${warning}; Outside schedule hours` : 'Outside schedule hours (6:30 AM - 3:30 PM)';
    }
    
    drafts.push({
      id: uuidv4(),
      week,
      day: day || 'Monday',
      startMinutes: Math.max(390, Math.min(finalStart, 915)),
      durationMinutes: Math.max(15, Math.min(finalDuration, 540)),
      title,
      location,
      notes,
      needsReview,
      warning,
    });
  }
  
  return { drafts, errors };
}

export function getCSVHeaders(content: string): string[] {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0) return [];
  return parseCSVLine(lines[0]);
}
