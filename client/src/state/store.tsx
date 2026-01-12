import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, Action, Plan, BlockTemplate, PlacedBlock } from './types';
import { loadState, saveState, createInitialState } from '@/lib/storage';

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;
      
    case 'ADD_TEMPLATE':
      return { ...state, templates: [...state.templates, action.payload] };
      
    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.map(t => 
          t.id === action.payload.id ? action.payload : t
        ),
      };
      
    case 'DELETE_TEMPLATE':
      return {
        ...state,
        templates: state.templates.filter(t => t.id !== action.payload),
      };
      
    case 'ADD_PLAN':
      return { ...state, plans: [...state.plans, action.payload] };
      
    case 'UPDATE_PLAN':
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === action.payload.id ? action.payload : p
        ),
      };
      
    case 'DELETE_PLAN':
      return {
        ...state,
        plans: state.plans.filter(p => p.id !== action.payload),
      };
      
    case 'ADD_BLOCK': {
      const { planId, block } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: [...p.blocks, block] }
            : p
        ),
      };
    }
      
    case 'UPDATE_BLOCK': {
      const { planId, block } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: p.blocks.map(b => b.id === block.id ? block : b) }
            : p
        ),
      };
    }
      
    case 'DELETE_BLOCK': {
      const { planId, blockId } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: p.blocks.filter(b => b.id !== blockId) }
            : p
        ),
      };
    }
      
    case 'COPY_WEEK': {
      const { planId, fromWeek, toWeek } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          
          const blocksFromWeek = p.blocks.filter(b => b.week === fromWeek);
          const newBlocks: PlacedBlock[] = blocksFromWeek.map(b => ({
            ...b,
            id: crypto.randomUUID(),
            week: toWeek,
          }));
          
          return { ...p, blocks: [...p.blocks, ...newBlocks] };
        }),
      };
    }
      
    case 'RESET_WEEK': {
      const { planId, week } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: p.blocks.filter(b => b.week !== week) }
            : p
        ),
      };
    }
      
    case 'IMPORT_STATE': {
      const { state: importedState, mode } = action.payload;
      if (mode === 'replace') {
        return importedState;
      }
      return {
        ...state,
        templates: [
          ...state.templates,
          ...importedState.templates.filter(
            it => !state.templates.some(t => t.id === it.id)
          ),
        ],
        plans: [
          ...state.plans,
          ...importedState.plans.filter(
            ip => !state.plans.some(p => p.id === ip.id)
          ),
        ],
      };
    }
      
    default:
      return state;
  }
}

interface StoreContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, createInitialState());
  const [initialized, setInitialized] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  
  useEffect(() => {
    const { state: loadedState, error } = loadState();
    if (error) {
      setLoadError(error);
    }
    dispatch({ type: 'LOAD_STATE', payload: loadedState });
    setInitialized(true);
  }, []);
  
  useEffect(() => {
    if (initialized) {
      saveState(state);
    }
  }, [state, initialized]);
  
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }
  
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {loadError && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 p-3 text-center text-sm">
          {loadError}
          <button 
            onClick={() => setLoadError(null)}
            className="ml-4 underline"
            data-testid="dismiss-error"
          >
            Dismiss
          </button>
        </div>
      )}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}
