import { PlacedBlock, TrainingExample, UnmatchedTrainingEvent } from '@/state/types';

export function buildTrainingDataFromBlocks(
  blocks: PlacedBlock[],
  source?: string
): { examples: TrainingExample[]; unmatched: UnmatchedTrainingEvent[] } {
  const examples: TrainingExample[] = [];
  const unmatched: UnmatchedTrainingEvent[] = [];

  for (const block of blocks) {
    if (block.templateId) {
      examples.push({
        templateId: block.templateId,
        weekIndex: block.week,
        dayOfWeek: block.day,
        startMinutes: block.startMinutes,
        durationMinutes: block.durationMinutes,
        source,
      });
    } else if (block.titleOverride && block.titleOverride.trim()) {
      unmatched.push({
        title: block.titleOverride.trim(),
        source,
      });
    }
  }

  return { examples, unmatched };
}
