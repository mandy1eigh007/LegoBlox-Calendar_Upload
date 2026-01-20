import { PlacedBlock, RecurrenceSeries, Day, DAYS, RecurrencePattern, Plan } from '@/state/types';
import { v4 as uuidv4 } from 'uuid';

export function createRecurringBlocks(
  baseBlock: PlacedBlock,
  pattern: RecurrencePattern,
  plan: Plan
): { series: RecurrenceSeries; blocks: PlacedBlock[] } {
  const seriesId = uuidv4();
  
  const series: RecurrenceSeries = {
    id: seriesId,
    templateId: baseBlock.templateId ?? 'UNASSIGNED',
    pattern,
    baseStartMinutes: baseBlock.startMinutes,
    baseDurationMinutes: baseBlock.durationMinutes,
    baseLocation: baseBlock.location,
    baseNotes: baseBlock.notes,
    countsTowardGoldenRule: baseBlock.countsTowardGoldenRule,
    goldenRuleBucketId: baseBlock.goldenRuleBucketId,
    isLocked: baseBlock.isLocked ?? false,
  };
  
  const blocks: PlacedBlock[] = [];
  
  const daysToApply = pattern.type === 'weekly' 
    ? [baseBlock.day] 
    : pattern.daysOfWeek;
  
  for (let week = pattern.startWeek; week <= pattern.endWeek; week++) {
    for (const day of daysToApply) {
      const existingBlock = plan.blocks.find(
        b => b.week === week && 
             b.day === day && 
             b.startMinutes === baseBlock.startMinutes &&
             b.templateId === baseBlock.templateId
      );
      
      if (existingBlock) {
        continue;
      }
      
      const baseFields = {
        templateId: baseBlock.templateId,
        startMinutes: baseBlock.startMinutes,
        durationMinutes: baseBlock.durationMinutes,
        titleOverride: baseBlock.titleOverride,
        location: baseBlock.location,
        notes: baseBlock.notes,
        countsTowardGoldenRule: baseBlock.countsTowardGoldenRule,
        goldenRuleBucketId: baseBlock.goldenRuleBucketId,
        resource: baseBlock.resource,
        category: baseBlock.category,
        partnerOrg: baseBlock.partnerOrg,
        partnerContact: baseBlock.partnerContact,
        partnerEmail: baseBlock.partnerEmail,
        partnerPhone: baseBlock.partnerPhone,
        partnerAddress: baseBlock.partnerAddress,
        partnerPPE: baseBlock.partnerPPE,
        partnerParking: baseBlock.partnerParking,
        isLocked: baseBlock.isLocked,
      };

      if (week === baseBlock.week && day === baseBlock.day) {
        blocks.push({
          ...baseFields,
          id: baseBlock.id,
          week,
          day,
          recurrenceSeriesId: seriesId,
          isRecurrenceException: false,
        });
      } else {
        blocks.push({
          ...baseFields,
          id: uuidv4(),
          week,
          day,
          recurrenceSeriesId: seriesId,
          isRecurrenceException: false,
        });
      }
    }
  }
  
  return { series, blocks };
}

export function getRecurrenceDescription(pattern: RecurrencePattern): string {
  if (pattern.type === 'none') {
    return 'Does not repeat';
  }
  
  if (pattern.type === 'weekly') {
    return `Weekly, Weeks ${pattern.startWeek}-${pattern.endWeek}`;
  }
  
  const dayNames = pattern.daysOfWeek.map(d => d.slice(0, 3)).join(', ');
  return `${dayNames}, Weeks ${pattern.startWeek}-${pattern.endWeek}`;
}

export function expandRecurringSeries(
  series: RecurrenceSeries,
  plan: Plan
): PlacedBlock[] {
  const blocks: PlacedBlock[] = [];
  const { pattern } = series;
  
  const daysToApply = pattern.type === 'weekly' 
    ? [pattern.daysOfWeek[0]] 
    : pattern.daysOfWeek;
  
  for (let week = pattern.startWeek; week <= pattern.endWeek; week++) {
    for (const day of daysToApply) {
      const existingBlock = plan.blocks.find(
        b => b.recurrenceSeriesId === series.id && 
             b.week === week && 
             b.day === day
      );
      
      if (existingBlock) {
        blocks.push(existingBlock);
      } else {
        blocks.push({
          id: uuidv4(),
          templateId: series.templateId,
          week,
          day,
          startMinutes: series.baseStartMinutes,
          durationMinutes: series.baseDurationMinutes,
          titleOverride: '',
          location: series.baseLocation,
          notes: series.baseNotes,
          countsTowardGoldenRule: series.countsTowardGoldenRule,
          goldenRuleBucketId: series.goldenRuleBucketId,
          recurrenceSeriesId: series.id,
          isRecurrenceException: false,
          isLocked: series.isLocked ?? false,
        });
      }
    }
  }
  
  return blocks;
}
