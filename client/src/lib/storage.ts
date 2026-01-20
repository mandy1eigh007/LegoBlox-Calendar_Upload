import { AppState, DEFAULT_RESOURCES } from '@/state/types';
import { createSeedTemplates } from './seedTemplates';
import { DAY_START_DEFAULT, DAY_END_DEFAULT } from './time';

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
  return {
    name: '',
    weeks: 9,
    dayStartMinutes: DAY_START_DEFAULT,
    dayEndMinutes: DAY_END_DEFAULT,
    slotMinutes: 15 as const,
    resources: [...DEFAULT_RESOURCES],
    allowOverlaps: true,
    showNotesOnPrint: true,
    schedulerMode: 'manual' as const,
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
          dayStartMinutes,
          dayEndMinutes,
          slotMinutes: 15 as const,
          resources: [...DEFAULT_RESOURCES],
          allowOverlaps: true,
          showNotesOnPrint: true,
          schedulerMode: 'manual' as const,
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
      for (const block of plan.blocks) {
        if (block.isLocked === undefined) {
          block.isLocked = false;
        }
      }
    }
    
    for (const template of parsed.templates) {
      if (template.isArchived === undefined) {
        template.isArchived = false;
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
