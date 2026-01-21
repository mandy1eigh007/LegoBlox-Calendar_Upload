import { AnchorEventDraft, AnchorPromptId, BlockTemplate, PlacedBlock, Day } from '@/state/types';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { getWeekDayFromDate } from '@/lib/dateMapping';
import { v4 as uuidv4 } from 'uuid';

export type AnchorPromptConfig = {
  id: AnchorPromptId;
  label: string;
  defaultTitle: string;
  countsTowardGoldenRule: boolean;
  defaultDurationMinutes?: number;
};

export type AnchorDateSelection = {
  id: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  createNow: boolean;
};

export type AnchorScheduleSelection = {
  enabled: boolean;
  rows: AnchorDateSelection[];
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

export function createAnchorSelections(dayStartMinutes: number, startDate?: string): Record<AnchorPromptId, AnchorScheduleSelection> {
  return ANCHOR_PROMPTS.reduce((acc, prompt) => {
    acc[prompt.id] = {
      enabled: false,
      rows: [
        {
          id: uuidv4(),
          date: startDate || '',
          startMinutes: dayStartMinutes,
          durationMinutes: prompt.defaultDurationMinutes ?? 60,
          createNow: true,
        },
      ],
    };
    return acc;
  }, {} as Record<AnchorPromptId, AnchorScheduleSelection>);
}

export function buildAnchorDraft(
  prompt: AnchorPromptConfig,
  selection: AnchorDateSelection
): AnchorEventDraft {
  return {
    id: selection.id,
    date: selection.date,
    startMinutes: selection.startMinutes,
    durationMinutes: selection.durationMinutes,
    title: prompt.defaultTitle,
    countsTowardGoldenRule: prompt.countsTowardGoldenRule,
    isLocked: true,
    created: selection.createNow,
  };
}

export function buildAnchorBlock(
  draft: AnchorEventDraft,
  templates: BlockTemplate[],
  startDate?: string,
  activeDays?: Day[],
  maxWeeks?: number
): { block: PlacedBlock | null; warning?: string } {
  const placement = getWeekDayFromDate(draft.date, startDate);
  if (!placement) {
    return { block: null, warning: 'Invalid anchor date.' };
  }
  if (placement.isWeekend) {
    return { block: null, warning: 'Anchor date falls on a weekend.' };
  }
  if (typeof maxWeeks === 'number' && (placement.week < 1 || placement.week > maxWeeks)) {
    return { block: null, warning: 'Anchor date is outside the plan weeks.' };
  }
  if (activeDays && activeDays.length > 0 && !activeDays.includes(placement.day)) {
    return { block: null, warning: 'Anchor date is outside active class days.' };
  }

  const matchResult = resolveTemplateForImportedTitle(draft.title, templates);
  const matchedTemplate = matchResult.templateId ? templates.find(t => t.id === matchResult.templateId) : null;
  const resolvedBucketId = draft.countsTowardGoldenRule
    ? (matchResult.bucketId ?? matchedTemplate?.goldenRuleBucketId ?? null)
    : null;

  return { 
    block: {
      id: uuidv4(),
    templateId: matchedTemplate?.id ?? null,
      week: placement.week,
      day: placement.day,
    startMinutes: draft.startMinutes,
    durationMinutes: draft.durationMinutes,
    titleOverride: draft.title,
    location: matchedTemplate?.defaultLocation ?? '',
      notes: `Anchor date: ${draft.date}`,
    countsTowardGoldenRule: draft.countsTowardGoldenRule,
    goldenRuleBucketId: resolvedBucketId,
    recurrenceSeriesId: null,
    isRecurrenceException: false,
    resource: matchedTemplate?.defaultResource || undefined,
    isLocked: draft.isLocked,
    },
  };
}
