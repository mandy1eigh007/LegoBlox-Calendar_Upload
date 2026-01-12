import { AppState } from '@/state/types';
import { validateAppState } from '@/state/validators';
import { createSeedTemplates } from './seedTemplates';

const STORAGE_KEY = 'schedule_builder_v1';

export function createInitialState(): AppState {
  return {
    version: 1,
    templates: createSeedTemplates(),
    plans: [],
  };
}

export function loadState(): { state: AppState; error?: string } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { state: createInitialState() };
    }
    
    const parsed = JSON.parse(stored);
    const validation = validateAppState(parsed);
    
    if (!validation.valid) {
      return { 
        state: createInitialState(), 
        error: `Data validation failed: ${validation.error}. Starting fresh.` 
      };
    }
    
    return { state: parsed as AppState };
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
}
