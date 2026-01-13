import { Plan, PlacedBlock, Day, DAYS } from '@/state/types';

export interface RoomConflict {
  type: 'ROOM_OVERLAP';
  resource: string;
  week: number;
  day: Day;
  startMinutes: number;
  endMinutes: number;
  planA: { id: string; name: string; blockId: string; title: string };
  planB: { id: string; name: string; blockId: string; title: string };
}

function overlapsTime(
  aStart: number, aDuration: number,
  bStart: number, bDuration: number
): boolean {
  const aEnd = aStart + aDuration;
  const bEnd = bStart + bDuration;
  return aStart < bEnd && bStart < aEnd;
}

export function comparePlans(planA: Plan, planB: Plan): RoomConflict[] {
  const conflicts: RoomConflict[] = [];
  
  const aBlocks = planA.blocks.filter(b => b.resource && b.resource !== 'ANY' && b.resource.trim() !== '');
  const bBlocks = planB.blocks.filter(b => b.resource && b.resource !== 'ANY' && b.resource.trim() !== '');
  
  for (const blockA of aBlocks) {
    for (const blockB of bBlocks) {
      if (blockA.week !== blockB.week) continue;
      if (blockA.day !== blockB.day) continue;
      if (blockA.resource !== blockB.resource) continue;
      
      if (overlapsTime(
        blockA.startMinutes, blockA.durationMinutes,
        blockB.startMinutes, blockB.durationMinutes
      )) {
        conflicts.push({
          type: 'ROOM_OVERLAP',
          resource: blockA.resource!,
          week: blockA.week,
          day: blockA.day,
          startMinutes: Math.min(blockA.startMinutes, blockB.startMinutes),
          endMinutes: Math.max(
            blockA.startMinutes + blockA.durationMinutes,
            blockB.startMinutes + blockB.durationMinutes
          ),
          planA: {
            id: planA.id,
            name: planA.settings.name,
            blockId: blockA.id,
            title: blockA.titleOverride || 'Untitled',
          },
          planB: {
            id: planB.id,
            name: planB.settings.name,
            blockId: blockB.id,
            title: blockB.titleOverride || 'Untitled',
          },
        });
      }
    }
  }
  
  return conflicts;
}

export function findAlternativeResource(
  block: PlacedBlock,
  plan: Plan,
  availableResources: string[]
): string | null {
  const conflictingResources = new Set<string>();
  
  for (const otherBlock of plan.blocks) {
    if (otherBlock.id === block.id) continue;
    if (otherBlock.week !== block.week) continue;
    if (otherBlock.day !== block.day) continue;
    if (!otherBlock.resource) continue;
    
    if (overlapsTime(
      block.startMinutes, block.durationMinutes,
      otherBlock.startMinutes, otherBlock.durationMinutes
    )) {
      conflictingResources.add(otherBlock.resource);
    }
  }
  
  for (const resource of availableResources) {
    if (resource === 'ANY') continue;
    if (!conflictingResources.has(resource)) {
      return resource;
    }
  }
  
  return null;
}

export function getResourceUsageSummary(
  plans: Plan[]
): Map<string, { planId: string; planName: string; count: number }[]> {
  const usage = new Map<string, { planId: string; planName: string; count: number }[]>();
  
  for (const plan of plans) {
    const resourceCounts = new Map<string, number>();
    
    for (const block of plan.blocks) {
      if (block.resource && block.resource !== 'ANY') {
        resourceCounts.set(block.resource, (resourceCounts.get(block.resource) || 0) + 1);
      }
    }
    
    for (const [resource, count] of Array.from(resourceCounts.entries())) {
      if (!usage.has(resource)) {
        usage.set(resource, []);
      }
      usage.get(resource)!.push({
        planId: plan.id,
        planName: plan.settings.name,
        count,
      });
    }
  }
  
  return usage;
}
