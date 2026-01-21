import { Day, DAYS } from '@/state/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMondayRef(date: Date): Date {
  const ref = new Date(date);
  const day = ref.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  ref.setDate(ref.getDate() + diff);
  ref.setHours(0, 0, 0, 0);
  return ref;
}

export function getWeekDayFromDate(
  dateStr: string,
  startDateStr?: string
): { week: number; day: Day; dayIndex: number; isWeekend: boolean } | null {
  const target = parseDateInput(dateStr);
  if (!target) return null;
  const start = startDateStr ? parseDateInput(startDateStr) : null;
  const mondayRef = start ? getMondayRef(start) : getMondayRef(target);
  const diffDays = Math.floor((target.getTime() - mondayRef.getTime()) / MS_PER_DAY);
  const week = Math.floor(diffDays / 7) + 1;
  const dayIndex = target.getDay();
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const weekdayIndex = Math.min(Math.max(dayIndex - 1, 0), DAYS.length - 1);
  const day = DAYS[weekdayIndex];
  return { week, day, dayIndex, isWeekend };
}

export function getDateForWeekDay(
  startDateStr: string,
  week: number,
  day: Day
): string | null {
  const start = parseDateInput(startDateStr);
  if (!start) return null;
  const mondayRef = getMondayRef(start);
  const dayIndex = DAYS.indexOf(day);
  if (dayIndex === -1) return null;
  const target = new Date(mondayRef);
  target.setDate(mondayRef.getDate() + (week - 1) * 7 + dayIndex);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const date = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}
