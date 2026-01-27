import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ScheduleSuggestionPanel } from '../ScheduleSuggestionPanel';

// Minimal mock plan and templates
const mockPlan: any = {
  id: 'plan-1',
  settings: { name: 'Test Plan', weeks: 9, dayStartMinutes: 390, dayEndMinutes: 930, slotMinutes: 15, hardDates: [] },
  blocks: [],
  isPublished: false,
  trainingExamples: [
    { templateId: 'T_OSHA', weekIndex: 1, dayOfWeek: 'Monday', startMinutes: 390, durationMinutes: 300, source: 'import:ics' },
  ],
  unmatchedTrainingEvents: [],
};

const mockTemplates: any[] = [
  { id: 'T_OSHA', title: 'OSHA 10', defaultDurationMinutes: 300, countsTowardGoldenRule: true, goldenRuleBucketId: 'OSHA_10', defaultLocation: '' },
  { id: 'UNASSIGNED', title: 'Unassigned', defaultDurationMinutes: 15, countsTowardGoldenRule: false, goldenRuleBucketId: null }
];

describe('ScheduleSuggestionPanel', () => {
  beforeEach(() => {
    // mock fetch for models and solver
    globalThis.fetch = vi.fn((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/api/predictive/training/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            probabilityTable: {
              entries: { w1_Monday_morning: { T_OSHA: 1 } },
              totalsByContext: { w1_Monday_morning: 1 },
              templateCounts: { T_OSHA: 1 },
              totalEvents: 1,
              version: 1,
              trainedFrom: ['seed'],
            },
            events: [
              { templateId: 'T_OSHA', weekIndex: 1, dayOfWeek: 'Monday', startMinutes: 390, durationMinutes: 300, source: 'seed' },
            ],
          })
        } as any);
      }
      if (url.endsWith('/api/predictive/models')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ models: [{ templateId: 'T_OSHA', topSlots: [{ slotIndex: 0, probability: 0.8, count: 10 }] }] }) } as any);
      }
      if (url.endsWith('/api/predictive/solve')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ placed: [{ id: 's1', templateId: 'T_OSHA', week: 1, day: 1, startMinutes: 390, durationMinutes: 300 }], unplaced: [] }) } as any);
      }
      return Promise.resolve({ ok: false } as any);
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders and generates suggestions with match rate summary', async () => {
    render(
      <ScheduleSuggestionPanel
        plan={mockPlan}
        templates={mockTemplates}
        currentWeek={1}
        open={true}
        onClose={() => {}}
        onAccept={() => {}}
        onUpdateHardDates={() => {}}
      />
    );

    // click the generate button
    const scopeWeek = await screen.findByTestId('scope-week');
    fireEvent.click(scopeWeek);
    const btn = await screen.findByTestId('generate-suggestions');
    fireEvent.click(btn);

    // wait for suggestion to appear
    await waitFor(() => expect(screen.getByText('OSHA 10')).toBeTruthy(), { timeout: 2000 });

    // match rate summary should appear
    await waitFor(() => expect(screen.getByText('Match Rate (import)')).toBeTruthy());
  });
});
