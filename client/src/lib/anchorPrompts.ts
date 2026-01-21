import { AnchorEventDraft, AnchorPromptId, BlockTemplate, Day, PlacedBlock } from '@/state/types';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { v4 as uuidv4 } from 'uuid';

export type AnchorPromptConfig = {
  id: AnchorPromptId;
  label: string;
  defaultTitle: string;
  countsTowardGoldenRule: boolean;
  defaultDurationMinutes?: number;
};

export type AnchorScheduleSelection = {
  enabled: boolean;
  createNow: boolean;
  week: number;
  day: Day;
  startMinutes: number;
  durationMinutes: number;
};

export const ANCHOR_PROMPTS: AnchorPromptConfig[] = [
  {
    id: 'math',
    label: 'Do you have a math schedule?',
    defaultTitle: 'Math',
    countsTowardGoldenRule: true,
    defaultDurationMinutes: 120,
  },
  {
    id: 'mock_interviews',
    label: 'Do you have mock interviews scheduled?',
    defaultTitle: 'Interviews (Interview Skills + Group Interviews + Mock Prep)',
    countsTowardGoldenRule: true,
    defaultDurationMinutes: 120,
  },
  {
    id: 'speed_mentoring',
    label: 'Do you have speed mentoring scheduled?',
    defaultTitle: 'Speed Mentoring',
    countsTowardGoldenRule: false,
    defaultDurationMinutes: 120,
  },
  {
    id: 'guest_speakers',
    label: 'Do you have guest speakers scheduled?',
    defaultTitle: 'Speaker Presentations',
    countsTowardGoldenRule: true,
    defaultDurationMinutes: 120,
  },
  {
    id: 'apprenticeship_tours',
    label: 'Do you have apprenticeship tours scheduled?',
    defaultTitle: 'Apprenticeship Tours',
    countsTowardGoldenRule: true,
    defaultDurationMinutes: 240,
  },
  {
    id: 'job_site_tours',
    label: 'Do you have job site tours scheduled?',
    defaultTitle: 'Worksite Tours',
    countsTowardGoldenRule: true,
    defaultDurationMinutes: 240,
  },
];

export function createEmptyAnchorChecklist(): Record<AnchorPromptId, boolean> {
  return ANCHOR_PROMPTS.reduce((acc, prompt) => {
    acc[prompt.id] = false;
    return acc;
  }, {} as Record<AnchorPromptId, boolean>);
}

export function createAnchorSelections(dayStartMinutes: number): Record<AnchorPromptId, AnchorScheduleSelection> {
  return ANCHOR_PROMPTS.reduce((acc, prompt) => {
    acc[prompt.id] = {
      enabled: false,
      createNow: true,
      week: 1,
      day: 'Monday',
      startMinutes: dayStartMinutes,
      durationMinutes: prompt.defaultDurationMinutes ?? 60,
    };
    return acc;
  }, {} as Record<AnchorPromptId, AnchorScheduleSelection>);
}

export function buildAnchorDraft(
  prompt: AnchorPromptConfig,
  selection: AnchorScheduleSelection
): AnchorEventDraft {
  return {
    week: selection.week,
    day: selection.day,
    startMinutes: selection.startMinutes,
    durationMinutes: selection.durationMinutes,
    title: prompt.defaultTitle,
    countsTowardGoldenRule: prompt.countsTowardGoldenRule,
    isLocked: true,
    created: selection.createNow,
  };
}

export function buildAnchorBlock(draft: AnchorEventDraft, templates: BlockTemplate[]): PlacedBlock {
  const matchResult = resolveTemplateForImportedTitle(draft.title, templates);
  const matchedTemplate = matchResult.templateId ? templates.find(t => t.id === matchResult.templateId) : null;
  const resolvedBucketId = draft.countsTowardGoldenRule
    ? (matchResult.bucketId ?? matchedTemplate?.goldenRuleBucketId ?? null)
    : null;

  return {
    id: uuidv4(),
    templateId: matchedTemplate?.id ?? null,
    week: draft.week,
    day: draft.day,
    startMinutes: draft.startMinutes,
    durationMinutes: draft.durationMinutes,
    titleOverride: draft.title,
    location: matchedTemplate?.defaultLocation ?? '',
    notes: '',
    countsTowardGoldenRule: draft.countsTowardGoldenRule,
    goldenRuleBucketId: resolvedBucketId,
    recurrenceSeriesId: null,
    isRecurrenceException: false,
    resource: matchedTemplate?.defaultResource || undefined,
    isLocked: draft.isLocked,
  };
}
