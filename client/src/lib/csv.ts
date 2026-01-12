import { Plan, BlockTemplate, Day, DAYS } from '@/state/types';
import { formatTimeDisplay, getEndTime } from './time';

export function exportToCSV(plan: Plan, templates: BlockTemplate[]): string {
  const headers = [
    'Plan Name',
    'Week',
    'Day',
    'Start Time',
    'End Time',
    'Title',
    'Category',
    'Golden Rule Topic',
    'Location',
    'Notes',
  ];
  
  const rows: string[][] = [headers];
  
  const sortedBlocks = [...plan.blocks].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    const dayIndexA = DAYS.indexOf(a.day);
    const dayIndexB = DAYS.indexOf(b.day);
    if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
    return a.startTime.localeCompare(b.startTime);
  });
  
  for (const block of sortedBlocks) {
    const template = templates.find(t => t.id === block.templateId);
    if (!template) continue;
    
    const title = block.titleOverride || template.title;
    const endTime = getEndTime(block.startTime, block.durationMin);
    
    rows.push([
      plan.settings.name,
      block.week.toString(),
      block.day,
      formatTimeDisplay(block.startTime),
      formatTimeDisplay(endTime),
      title,
      template.category,
      template.goldenRuleTopic,
      block.location || template.defaultLocation || '',
      block.notes || template.defaultNotes || '',
    ]);
  }
  
  return rows
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
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
