import { AnchorPromptId } from '@/state/types';

export type AnchorPromptConfig = {
  id: AnchorPromptId;
  label: string;
  defaultTitle: string;
  countsTowardGoldenRule: boolean;
  defaultDurationMinutes?: number;
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
