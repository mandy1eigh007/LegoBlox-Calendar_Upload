import { AppState, DEFAULT_RESOURCES, DAYS, AnchorEventDraft, AnchorPromptId, Day } from '@/state/types';
import { createSeedTemplates } from './seedTemplates';
import { DAY_START_DEFAULT, DAY_END_DEFAULT } from './time';
import { getDateForWeekDay } from './dateMapping';

const STORAGE_KEY = 'cohort_schedule_builder_v2';

export function createInitialState(): AppState {
  return {
    version: 2,
    templates: createSeedTemplates(),
    plans: [],
    partners: {
      orgs: [],
      contacts: [],
      engagements: [],
    },
  };
}

export function createDefaultPlanSettings() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return {
    name: '',
    weeks: 9,
    startDate: `${yyyy}-${mm}-${dd}`,
    activeDays: [...DAYS],
    dayStartMinutes: DAY_START_DEFAULT,
    dayEndMinutes: DAY_END_DEFAULT,
    slotMinutes: 15 as const,
    resources: [...DEFAULT_RESOURCES],
    allowOverlaps: true,
    showNotesOnPrint: true,
    schedulerMode: 'manual' as const,
    bucketAdjustments: {},
    anchorChecklist: {},
    anchorSchedule: {},
    anchorWizardDismissed: false,
    partnerRequests: [],
  };
}

function isValidState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const s = data as Record<string, unknown>;
  if (s.version !== 2) return false;
  if (!Array.isArray(s.templates)) return false;
  if (!Array.isArray(s.plans)) return false;
  if (!s.partners) {
    s.partners = { orgs: [], contacts: [], engagements: [] };
  }
  return true;
}

function migrateV1ToV2(oldState: unknown): AppState | null {
  if (!oldState || typeof oldState !== 'object') return null;
  const s = oldState as Record<string, unknown>;
  
  if (s.version === 1 && Array.isArray(s.templates) && Array.isArray(s.plans)) {
    const newTemplates = (s.templates as unknown[]).map((t: unknown) => {
      const template = t as Record<string, unknown>;
      return {
        id: template.id as string,
        title: template.title as string,
        category: template.category as string,
        colorHex: template.colorHex as string,
        defaultDurationMinutes: (template.defaultDurationMin as number) || 60,
        countsTowardGoldenRule: !!template.goldenRuleKey,
        goldenRuleBucketId: (template.goldenRuleKey as string) || null,
        defaultLocation: '',
        defaultNotes: '',
        isArchived: false,
      };
    });
    
    const newPlans = (s.plans as unknown[]).map((p: unknown) => {
      const plan = p as Record<string, unknown>;
      const oldSettings = plan.settings as Record<string, unknown>;
      
      const dayStartMinutes = oldSettings.dayStartTime 
        ? parseInt((oldSettings.dayStartTime as string).split(':')[0]) * 60 + 
          parseInt((oldSettings.dayStartTime as string).split(':')[1])
        : DAY_START_DEFAULT;
        
      const dayEndMinutes = oldSettings.dayEndTime 
        ? parseInt((oldSettings.dayEndTime as string).split(':')[0]) * 60 + 
          parseInt((oldSettings.dayEndTime as string).split(':')[1])
        : DAY_END_DEFAULT;
      
      const newBlocks = (plan.blocks as unknown[] || []).map((b: unknown) => {
        const block = b as Record<string, unknown>;
        const startTime = block.startTime as string;
        const startMinutes = startTime 
          ? parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1])
          : dayStartMinutes;
        
        return {
          id: block.id as string,
          templateId: block.templateId as string,
          week: block.week as number,
          day: block.day as string,
          startMinutes,
          durationMinutes: (block.durationMin as number) || 60,
          titleOverride: (block.titleOverride as string) || '',
          location: (block.location as string) || '',
          notes: (block.notes as string) || '',
          countsTowardGoldenRule: true,
          goldenRuleBucketId: null,
          recurrenceSeriesId: null,
          isRecurrenceException: false,
          isLocked: false,
        };
      });
      
      return {
        id: plan.id as string,
        settings: {
          name: oldSettings.name as string,
          weeks: (oldSettings.weeks as number) || 9,
          startDate: undefined,
          activeDays: [...DAYS],
          dayStartMinutes,
          dayEndMinutes,
          slotMinutes: 15 as const,
          resources: [...DEFAULT_RESOURCES],
          allowOverlaps: true,
          showNotesOnPrint: true,
          schedulerMode: 'manual' as const,
          bucketAdjustments: {},
          anchorChecklist: {},
          anchorSchedule: {},
          anchorWizardDismissed: false,
          partnerRequests: [],
        },
        blocks: newBlocks,
        recurrenceSeries: [],
      };
    });
    
    return {
      version: 2,
      templates: newTemplates as AppState['templates'],
      plans: newPlans as AppState['plans'],
      partners: { orgs: [], contacts: [], engagements: [] },
    };
  }
  
  return null;
}

export function loadState(): { state: AppState; error?: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const oldStored = localStorage.getItem('schedule_builder_v1');
      if (oldStored) {
        const oldParsed = JSON.parse(oldStored);
        const migrated = migrateV1ToV2(oldParsed);
        if (migrated) {
          saveState(migrated);
          return { state: migrated };
        }
      }
      return { state: createInitialState() };
    }
    
    const parsed = JSON.parse(stored);
    
    if (!isValidState(parsed)) {
      return { 
        state: createInitialState(), 
        error: 'Data format changed. Starting fresh with templates.' 
      };
    }
    
    for (const plan of parsed.plans) {
      if (!plan.settings.schedulerMode) {
        plan.settings.schedulerMode = 'manual';
      }
      if (!plan.settings.bucketAdjustments) {
        plan.settings.bucketAdjustments = {};
      }
      if (!plan.settings.anchorChecklist) {
        plan.settings.anchorChecklist = {};
      }
      if (!plan.settings.anchorSchedule) {
        plan.settings.anchorSchedule = {};
      }
      if (plan.settings.anchorWizardDismissed === undefined) {
        plan.settings.anchorWizardDismissed = false;
      }
      if (plan.settings.anchorSchedule) {
        const anchorSchedule = plan.settings.anchorSchedule as Partial<Record<AnchorPromptId, AnchorEventDraft[] | AnchorEventDraft>>;
        for (const [key, value] of Object.entries(anchorSchedule)) {
          if (!value) continue;
          if (Array.isArray(value)) {
            for (const entry of value) {
              if (!('type' in entry)) {
                (entry as AnchorEventDraft).type = 'date';
              }
              if ((entry as any).type === 'date' && !(entry as any).date && (entry as any).week && (entry as any).day) {
                const date = plan.settings.startDate
                  ? getDateForWeekDay(plan.settings.startDate, (entry as any).week, (entry as any).day) || plan.settings.startDate
                  : plan.settings.startDate || '';
                (entry as any).date = date;
              }
              if ((entry as any).isAfterHours === undefined) {
                (entry as any).isAfterHours = false;
              }
            }
            continue;
          }
          const legacy = value as { week?: number; day?: Day; startMinutes?: number; durationMinutes?: number; title?: string; countsTowardGoldenRule?: boolean; isLocked?: boolean; created?: boolean };
          const date = plan.settings.startDate && legacy.week && legacy.day
            ? getDateForWeekDay(plan.settings.startDate, legacy.week, legacy.day) || plan.settings.startDate
            : plan.settings.startDate || '';
          anchorSchedule[key as AnchorPromptId] = [
            {
              type: 'date',
              id: `legacy_${Date.now().toString(36)}`,
              date: date || '',
              startMinutes: legacy.startMinutes ?? plan.settings.dayStartMinutes,
              durationMinutes: legacy.durationMinutes ?? 60,
              title: legacy.title || '',
              countsTowardGoldenRule: !!legacy.countsTowardGoldenRule,
              isLocked: legacy.isLocked ?? true,
              isAfterHours: false,
              created: legacy.created,
            },
          ];
        }
      }
      if (!plan.settings.partnerRequests) {
        plan.settings.partnerRequests = [];
      }
      if (!plan.settings.startDate) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        plan.settings.startDate = `${yyyy}-${mm}-${dd}`;
      }
      if (!plan.settings.activeDays || plan.settings.activeDays.length === 0) {
        plan.settings.activeDays = [...DAYS];
      }
      if (!plan.trainingExamples) {
        plan.trainingExamples = [];
      }
      if (!plan.unmatchedTrainingEvents) {
        plan.unmatchedTrainingEvents = [];
      }
      for (const block of plan.blocks) {
        if (block.isLocked === undefined) {
          block.isLocked = false;
        }
        if (block.isAfterHours === undefined) {
          block.isAfterHours = false;
        }
      }
    }
    
    for (const template of parsed.templates) {
      if (template.isArchived === undefined) {
        template.isArchived = false;
      }
    }

    const mathTemplateExists = parsed.templates.some((template: { goldenRuleBucketId?: string | null; title?: string }) =>
      template.goldenRuleBucketId === 'MATH' || (template.title || '').toLowerCase() === 'math'
    );
    if (!mathTemplateExists) {
      const seedMath = createSeedTemplates().find(template => template.goldenRuleBucketId === 'MATH');
      if (seedMath) {
        parsed.templates.push(seedMath);
      }
    }
    
    return { state: parsed };
  } catch (e) {
    return { 
      state: createInitialState(), 
      error: 'Failed to load saved data. Starting fresh.' 
    };
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

export function resetStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('schedule_builder_v1');
}
