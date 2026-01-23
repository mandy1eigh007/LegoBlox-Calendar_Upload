import { Day, DAYS } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';
import { minutesToTimeDisplay as sharedMinutesToTimeDisplay } from './time';

export interface OCREvent {
  id: string;
  title: string;
  day: Day | null;
  startTime: string;
  endTime: string;
  startMinutes: number | null;
  endMinutes: number | null;
  confidence: number;
  rawText: string;
}

function parseTimeFromText(text: string): number | null {
  const cleanText = text.replace(/[^\d:apmAPM\s]/g, '').trim();
  
  const match12 = cleanText.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = parseInt(match12[2] || '0');
    const period = match12[3].toLowerCase();
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  const match24 = cleanText.match(/(\d{1,2}):(\d{2})/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const minutes = parseInt(match24[2]);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }
  
  const hourOnlyMatch = cleanText.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (hourOnlyMatch) {
    let hours = parseInt(hourOnlyMatch[1]);
    const period = hourOnlyMatch[2].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return hours * 60;
  }
  
  return null;
}

function detectDayFromText(text: string): Day | null {
  const lowerText = text.toLowerCase();
  const dayPatterns: [RegExp, Day][] = [
    [/\bmon(day)?\b/i, 'Monday'],
    [/\btue(s|sday)?\b/i, 'Tuesday'],
    [/\bwed(nesday)?\b/i, 'Wednesday'],
    [/\bthu(r|rs|rsday)?\b/i, 'Thursday'],
    [/\bfri(day)?\b/i, 'Friday'],
  ];
  
  for (const [pattern, day] of dayPatterns) {
    if (pattern.test(lowerText)) {
      return day;
    }
  }
  return null;
}

function extractTimeRange(text: string): { start: string; end: string } | null {
  const patterns = [
    /(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*[-–—to]+\s*(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { start: match[1], end: match[2] };
    }
  }
  return null;
}

function isTimeOnly(text: string): boolean {
  const cleaned = text.trim();
  return /^\d{1,2}\s*(am|pm|AM|PM)$/.test(cleaned) || 
         /^\d{1,2}:\d{2}\s*(am|pm|AM|PM)?$/.test(cleaned);
}

function isDayOnly(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  return /^(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)$/i.test(cleaned);
}

function isDateOnly(text: string): boolean {
  const cleaned = text.trim();
  return /^\d{1,2}$/.test(cleaned) || 
         /^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(cleaned) ||
         /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(cleaned);
}

function isNavigationOrUI(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  const uiTerms = ['today', 'week', 'month', 'day', 'agenda', 'schedule', 'calendar', 'view', 'saturday', 'sunday'];
  return uiTerms.some(term => cleaned === term);
}

function isLikelyEventTitle(text: string): boolean {
  const cleaned = text.trim();
  if (cleaned.length < 3) return false;
  if (isTimeOnly(cleaned)) return false;
  if (isDayOnly(cleaned)) return false;
  if (isDateOnly(cleaned)) return false;
  if (isNavigationOrUI(cleaned)) return false;
  if (/^\d+$/.test(cleaned)) return false;
  if (cleaned.length > 100) return false;
  
  const hasLetters = /[a-zA-Z]{2,}/.test(cleaned);
  return hasLetters;
}

export async function processImageWithOCR(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<{ events: OCREvent[]; rawText: string }> {
  const Tesseract = await import('tesseract.js');
  
  const result = await Tesseract.recognize(imageFile, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  
  const rawText = result.data.text;
  const lines = rawText.split('\n').filter(l => l.trim());
  const events: OCREvent[] = [];
  
  let currentDay: Day | null = null;
  const dayColumns: Day[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const detectedDay = detectDayFromText(line);
    if (detectedDay && isDayOnly(line)) {
      currentDay = detectedDay;
      if (!dayColumns.includes(detectedDay)) {
        dayColumns.push(detectedDay);
      }
      continue;
    }
    
    const timeRange = extractTimeRange(line);
    if (timeRange) {
      const startMinutes = parseTimeFromText(timeRange.start);
      const endMinutes = parseTimeFromText(timeRange.end);
      
      let title = line
        .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, '')
        .replace(/[-–—to]+/g, '')
        .replace(/\b(mon|tue|wed|thu|fri|monday|tuesday|wednesday|thursday|friday)\b/gi, '')
        .trim();
      
      if (!title && i + 1 < lines.length) {
        title = lines[i + 1].trim();
      }
      
      if (!title) {
        title = 'Untitled Event';
      }
      
      events.push({
        id: uuidv4(),
        title,
        day: currentDay || dayColumns[0] || 'Monday',
        startTime: timeRange.start,
        endTime: timeRange.end,
        startMinutes,
        endMinutes,
        confidence: result.data.confidence / 100,
        rawText: line,
      });
      continue;
    }
    
    if (isLikelyEventTitle(line)) {
      const cleanTitle = line
        .replace(/\b(mon|tue|wed|thu|fri|monday|tuesday|wednesday|thursday|friday)\b/gi, '')
        .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, '')
        .replace(/\d{1,2}\s*(am|pm)/gi, '')
        .trim();
      
      if (cleanTitle.length >= 3) {
        const lineDay = detectedDay || currentDay || (dayColumns.length > 0 ? dayColumns[Math.floor(Math.random() * dayColumns.length)] : 'Monday');
        
        events.push({
          id: uuidv4(),
          title: cleanTitle,
          day: lineDay,
          startTime: '8:00 AM',
          endTime: '9:00 AM',
          startMinutes: 480,
          endMinutes: 540,
          confidence: result.data.confidence / 100,
          rawText: line,
        });
      }
    }
  }
  
  const uniqueEvents: OCREvent[] = [];
  const seenTitles = new Set<string>();
  
  for (const event of events) {
    const normalizedTitle = event.title.toLowerCase().trim();
    if (!seenTitles.has(normalizedTitle) && normalizedTitle !== 'lunch') {
      seenTitles.add(normalizedTitle);
      uniqueEvents.push(event);
    } else if (normalizedTitle === 'lunch' && !seenTitles.has(`lunch-${event.day}`)) {
      seenTitles.add(`lunch-${event.day}`);
      uniqueEvents.push({
        ...event,
        startMinutes: 720,
        endMinutes: 780,
        startTime: '12:00 PM',
        endTime: '1:00 PM',
      });
    }
  }
  
  return { events: uniqueEvents, rawText };
}

export { sharedMinutesToTimeDisplay as minutesToTimeDisplay };
