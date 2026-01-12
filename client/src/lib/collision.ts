import { PlacedBlock, Day, AllowedDuration } from '@/state/types';
import { timeToMinutes, minutesToTime, getEndTime } from './time';

export interface Collision {
  block: PlacedBlock;
  startTime: string;
  endTime: string;
}

export function checkOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  return start1 < end2 && end1 > start2;
}

export function findCollisions(
  blocks: PlacedBlock[],
  week: number,
  day: Day,
  startTime: string,
  durationMin: number,
  excludeBlockId?: string
): Collision[] {
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + durationMin;
  
  return blocks
    .filter(block => {
      if (excludeBlockId && block.id === excludeBlockId) return false;
      if (block.week !== week || block.day !== day) return false;
      
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = blockStart + block.durationMin;
      
      return checkOverlap(startMin, endMin, blockStart, blockEnd);
    })
    .map(block => ({
      block,
      startTime: block.startTime,
      endTime: getEndTime(block.startTime, block.durationMin),
    }));
}

export function findNextAvailableSlot(
  blocks: PlacedBlock[],
  week: number,
  day: Day,
  startTime: string,
  durationMin: AllowedDuration,
  dayStartTime: string,
  dayEndTime: string,
  slotMin: number = 15,
  excludeBlockId?: string
): string | null {
  const dayStart = timeToMinutes(dayStartTime);
  const dayEnd = timeToMinutes(dayEndTime);
  const startMin = Math.max(timeToMinutes(startTime), dayStart);
  
  for (let currentMin = startMin; currentMin + durationMin <= dayEnd; currentMin += slotMin) {
    const collisions = findCollisions(
      blocks,
      week,
      day,
      minutesToTime(currentMin),
      durationMin,
      excludeBlockId
    );
    
    if (collisions.length === 0) {
      return minutesToTime(currentMin);
    }
  }
  
  return null;
}

export function wouldFitInDay(
  startTime: string,
  durationMin: number,
  dayEndTime: string
): boolean {
  const endMin = timeToMinutes(startTime) + durationMin;
  const dayEnd = timeToMinutes(dayEndTime);
  return endMin <= dayEnd;
}
