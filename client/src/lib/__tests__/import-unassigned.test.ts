import { describe, it, expect } from 'vitest';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { convertICSEventsToBlocks } from '@/lib/csv';
import type { BlockTemplate } from '@/state/types';

describe('Import -> Unassigned behavior', () => {
  const templates: BlockTemplate[] = [
    {
      id: 't-intro',
      title: 'Introduction to Pre-Apprenticeship',
      category: 'PD',
      colorHex: '#000000',
      defaultDurationMinutes: 60,
      countsTowardGoldenRule: true,
      goldenRuleBucketId: 'INTRO_PREAPP',
      defaultLocation: '',
      defaultNotes: '',
    },
    {
      id: 't-resume',
      title: 'Resume Workshop',
      category: 'PD',
      colorHex: '#111111',
      defaultDurationMinutes: 60,
      countsTowardGoldenRule: true,
      goldenRuleBucketId: 'RESUMES',
      defaultLocation: '',
      defaultNotes: '',
    },
  ];

  it('returns null templateId for unknown titles', () => {
    const result = resolveTemplateForImportedTitle('Some Unknown Nonmatching Title', templates);
    expect(result.templateId).toBeNull();
  });

  it('convertICSEventsToBlocks produces unassigned block for unknown title', () => {
    const dtstart = new Date(2026, 0, 13, 9, 0);
    const dtend = new Date(2026, 0, 13, 10, 0);

    const events = [
      {
        uid: 'u1',
        summary: 'Some Unknown Nonmatching Title',
        dtstart,
        dtend,
        location: '',
        description: '',
        originalTimezone: null,
        isUTC: false,
        localDateStr: '2026-01-13',
        startMinutesOriginal: 9 * 60,
        startMinutesRounded: 9 * 60,
        durationMinutesOriginal: 60,
        durationMinutesRounded: 60,
        wasRounded: false,
        roundingNote: '',
        isOutsideScheduleHours: false,
        isWeekend: false,
      },
    ];

    const startDate = new Date(2026, 0, 12);
    const endDate = new Date(2026, 0, 20);

    const { blocks, included } = convertICSEventsToBlocks(events as any, templates, startDate, endDate, false);
    expect(included).toBe(1);
    expect(blocks.length).toBe(1);
    expect(blocks[0].templateId).toBeNull();
    expect(blocks[0].countsTowardGoldenRule).toBe(false);
  });
});
