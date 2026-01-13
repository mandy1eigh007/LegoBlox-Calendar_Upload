export const SLOT_HEIGHT_PX = 24;
export const SLOT_MINUTES = 15;
export const DAY_START_MIN = 390; // 6:30 AM
export const DAY_END_MIN = 930; // 3:30 PM
export const DAY_START_DEFAULT = 390;
export const DAY_END_DEFAULT = 930;

export function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

export function formatTime(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function timeToMinutes(time: string): number {
  const { hours, minutes } = parseTime(time);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return formatTime(hours, minutes);
}

export function minutesToTimeDisplay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function formatTimeDisplay(time: string): string {
  const { hours, minutes } = parseTime(time);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatMinutesAsHoursMinutes(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  if (hours === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${hours}h`;
  return `${sign}${hours}h ${mins}m`;
}

export function generateTimeSlots(startMinutes: number, endMinutes: number, slotMin: number = 15): number[] {
  const slots: number[] = [];
  for (let m = startMinutes; m < endMinutes; m += slotMin) {
    slots.push(m);
  }
  return slots;
}

export function getEndMinutes(startMinutes: number, durationMinutes: number): number {
  return startMinutes + durationMinutes;
}

export function snapToSlot(minutes: number, slotMin: number = 15): number {
  return Math.round(minutes / slotMin) * slotMin;
}

export function clampMinutes(minutes: number, startMinutes: number, endMinutes: number): number {
  return Math.min(Math.max(minutes, startMinutes), endMinutes);
}

export function clampToDay(minutes: number, dayStartMinutes: number = DAY_START_MIN, dayEndMinutes: number = DAY_END_MIN): number {
  return Math.min(Math.max(minutes, dayStartMinutes), dayEndMinutes);
}

export function calculateSlotIndex(yWithinGrid: number): number {
  return Math.floor(yWithinGrid / SLOT_HEIGHT_PX);
}

export function slotIndexToMinutes(slotIndex: number, dayStartMinutes: number): number {
  return dayStartMinutes + (slotIndex * SLOT_MINUTES);
}

export function minutesToPixelOffset(minutes: number, dayStartMinutes: number): number {
  const slotIndex = (minutes - dayStartMinutes) / SLOT_MINUTES;
  return slotIndex * SLOT_HEIGHT_PX;
}

export function durationToPixelHeight(durationMinutes: number): number {
  return (durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

/**
 * Convert pixel Y position to minutes, accounting for grid positioning and scroll
 * @param y - Client Y position (from mouse event)
 * @param gridRect - Bounding rectangle of the grid container
 * @param scrollTop - Current scroll position of the grid
 * @param dayStartMinutes - Starting time of the day in minutes
 * @param headerHeight - Height of any header above the time slots (default 41px)
 * @returns Minutes from start of day, snapped to SLOT_MINUTES
 */
export function pxToMinutes(
  y: number,
  gridRect: DOMRect,
  scrollTop: number,
  dayStartMinutes: number,
  headerHeight: number = 41
): number {
  // Calculate position within the scrollable grid
  const yWithinGrid = (y - gridRect.top - headerHeight) + scrollTop;
  
  // Convert to slot index
  const slotIndex = Math.round(yWithinGrid / SLOT_HEIGHT_PX);
  
  // Convert to minutes from start of day
  const minutesFromStart = slotIndex * SLOT_MINUTES;
  
  // Get absolute minutes
  const rawMinutes = dayStartMinutes + minutesFromStart;
  
  // Snap to slot and clamp to day bounds
  const snapped = snapToSlot(rawMinutes, SLOT_MINUTES);
  return snapped;
}
