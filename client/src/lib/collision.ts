import { PlacedBlock, Day } from '@/state/types';
import { getEndMinutes } from './time';

export interface Conflict {
  block: PlacedBlock;
  reason: string;
}

export function checkOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

export function findConflicts(
  blocks: PlacedBlock[],
  week: number,
  day: Day,
  startMinutes: number,
  durationMinutes: number,
  location: string,
  excludeBlockId?: string
): Conflict[] {
  const endMinutes = getEndMinutes(startMinutes, durationMinutes);
  const conflicts: Conflict[] = [];
  
  for (const block of blocks) {
    if (excludeBlockId && block.id === excludeBlockId) continue;
    if (block.week !== week || block.day !== day) continue;
    
    const blockEnd = getEndMinutes(block.startMinutes, block.durationMinutes);
    
    if (!checkOverlap(startMinutes, endMinutes, block.startMinutes, blockEnd)) {
      continue;
    }
    
    if (location && block.location && location === block.location) {
      conflicts.push({
        block,
        reason: `Conflicts with block at same location: ${location}`,
      });
    } else {
      conflicts.push({
        block,
        reason: 'Time overlap',
      });
    }
  }
  
  return conflicts;
}

export function findNextAvailableSlot(
  blocks: PlacedBlock[],
  week: number,
  day: Day,
  startMinutes: number,
  durationMinutes: number,
  dayStartMinutes: number,
  dayEndMinutes: number,
  slotMinutes: number = 15,
  excludeBlockId?: string,
  resource?: string
): number | null {
  for (let currentMin = startMinutes; currentMin + durationMinutes <= dayEndMinutes; currentMin += slotMinutes) {
    const conflicts = findTimeConflicts(
      blocks,
      week,
      day,
      currentMin,
      durationMinutes,
      excludeBlockId,
      resource
    );
    
    if (conflicts.length === 0) {
      return currentMin;
    }
  }
  
  return null;
}

export function findTimeConflicts(
  blocks: PlacedBlock[],
  week: number,
  day: Day,
  startMinutes: number,
  durationMinutes: number,
  excludeBlockId?: string,
  resource?: string
): PlacedBlock[] {
  const endMinutes = getEndMinutes(startMinutes, durationMinutes);

  return blocks.filter(block => {
    if (excludeBlockId && block.id === excludeBlockId) return false;
    if (block.week !== week || block.day !== day) return false;

    const blockEnd = getEndMinutes(block.startMinutes, block.durationMinutes);
    if (!checkOverlap(startMinutes, endMinutes, block.startMinutes, blockEnd)) return false;

    // Resource-aware conflict: if both sides have a resource defined, require equality to conflict.
    // If either side does not define resource, treat as a conflict (conservative).
    if (resource && block.resource) {
      if (resource !== block.resource) return false;
    }

    return true;
  });
}

export function wouldFitInDay(
  startMinutes: number,
  durationMinutes: number,
  dayEndMinutes: number
): boolean {
  return getEndMinutes(startMinutes, durationMinutes) <= dayEndMinutes;
}
