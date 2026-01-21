import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ScheduleSuggestionPanel } from '../ScheduleSuggestionPanel';
import { createEmptyProbabilityTable, saveProbabilityTable } from '@/lib/probabilityLearning';

// Minimal mock plan and templates
const mockPlan: any = {
  settings: { name: 'Test Plan', weeks: 9, dayStartMinutes: 390, dayEndMinutes: 930, slotMinutes: 15, hardDates: [] },
  blocks: [],
  isPublished: false,
};

const mockTemplates: any[] = [
  { id: 'T_OSHA', title: 'OSHA 10', defaultDurationMinutes: 300, countsTowardGoldenRule: true, goldenRuleBucketId: 'OSHA_10', defaultLocation: '' },
  { id: 'UNASSIGNED', title: 'Unassigned', defaultDurationMinutes: 15, countsTowardGoldenRule: false, goldenRuleBucketId: null }
];

describe('ScheduleSuggestionPanel', () => {
  beforeEach(() => {
    const table = createEmptyProbabilityTable();
    table.totalEvents = 30;
    table.templateCounts.set('T_OSHA', 30);
    table.entries.set('w1_Monday_morning', new Map([['T_OSHA', 30]]));
    table.totalsByContext.set('w1_Monday_morning', 30);
    saveProbabilityTable(table);
    // mock fetch for models and solver
    globalThis.fetch = vi.fn((input: any) => {
      const url = typeof input === 'string' ? input : input.url;
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

  it('renders and generates suggestions showing confidence badge', async () => {
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

    // confidence badge (80%) should appear
    await waitFor(() => expect(screen.getByText('80%')).toBeTruthy());
  });
});
