import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import { AppState, Action, PlacedBlock, RecurrenceSeries } from './types';
import { loadState, saveState, createInitialState } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

function touchPlan(plan: AppState['plans'][number], timestamp?: string) {
  return { ...plan, updatedAt: timestamp || new Date().toISOString() };
}

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

    case 'DUPLICATE_TEMPLATE': {
      const original = state.templates.find(t => t.id === action.payload);
      if (!original) return state;
      const duplicate = {
        ...original,
        id: uuidv4(),
        title: `${original.title} (Copy)`,
      };
      return { ...state, templates: [...state.templates, duplicate] };
    }

    case 'RESET_TEMPLATES':
      return { ...state, templates: action.payload };
      
    case 'ADD_PLAN': {
      const plan = action.payload.updatedAt ? action.payload : touchPlan(action.payload);
      return { ...state, plans: [...state.plans, plan] };
    }
      
    case 'UPDATE_PLAN':
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === action.payload.id ? touchPlan(action.payload) : p
        ),
      };
      
    case 'DELETE_PLAN':
      return {
        ...state,
        plans: state.plans.filter(p => p.id !== action.payload),
      };
      
    case 'ADD_BLOCK': {
      const { planId, block } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: [...p.blocks, block], updatedAt }
            : p
        ),
      };
    }
      
    case 'UPDATE_BLOCK': {
      const { planId, block, scope } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          
          if (!scope || scope === 'this') {
            const updatedBlock = { ...block, isRecurrenceException: !!block.recurrenceSeriesId };
            return { ...p, blocks: p.blocks.map(b => b.id === block.id ? updatedBlock : b), updatedAt };
          }
          
          if (scope === 'thisAndFuture' && block.recurrenceSeriesId) {
            return {
              ...p,
              blocks: p.blocks.map(b => {
                if (b.recurrenceSeriesId === block.recurrenceSeriesId && b.week >= block.week) {
                  return {
                    ...b,
                    startMinutes: block.startMinutes,
                    durationMinutes: block.durationMinutes,
                    titleOverride: block.titleOverride,
                    location: block.location,
                    notes: block.notes,
                    countsTowardGoldenRule: block.countsTowardGoldenRule,
                    goldenRuleBucketId: block.goldenRuleBucketId,
                    resource: block.resource,
                    category: block.category,
                    partnerOrg: block.partnerOrg,
                    partnerContact: block.partnerContact,
                    partnerEmail: block.partnerEmail,
                    partnerPhone: block.partnerPhone,
                    partnerAddress: block.partnerAddress,
                    partnerPPE: block.partnerPPE,
                    partnerParking: block.partnerParking,
                    isLocked: block.isLocked,
                    isAfterHours: block.isAfterHours,
                  };
                }
                return b;
              }),
              updatedAt,
            };
          }
          
          if (scope === 'all' && block.recurrenceSeriesId) {
            return {
              ...p,
              blocks: p.blocks.map(b => {
                if (b.recurrenceSeriesId === block.recurrenceSeriesId) {
                  return {
                    ...b,
                    startMinutes: block.startMinutes,
                    durationMinutes: block.durationMinutes,
                    titleOverride: block.titleOverride,
                    location: block.location,
                    notes: block.notes,
                    countsTowardGoldenRule: block.countsTowardGoldenRule,
                    goldenRuleBucketId: block.goldenRuleBucketId,
                    resource: block.resource,
                    category: block.category,
                    partnerOrg: block.partnerOrg,
                    partnerContact: block.partnerContact,
                    partnerEmail: block.partnerEmail,
                    partnerPhone: block.partnerPhone,
                    partnerAddress: block.partnerAddress,
                    partnerPPE: block.partnerPPE,
                    partnerParking: block.partnerParking,
                    isLocked: block.isLocked,
                    isAfterHours: block.isAfterHours,
                  };
                }
                return b;
              }),
              recurrenceSeries: p.recurrenceSeries.map(s => {
                if (s.id === block.recurrenceSeriesId) {
                  return {
                    ...s,
                    baseStartMinutes: block.startMinutes,
                    baseDurationMinutes: block.durationMinutes,
                    baseLocation: block.location,
                    baseNotes: block.notes,
                    countsTowardGoldenRule: block.countsTowardGoldenRule,
                    goldenRuleBucketId: block.goldenRuleBucketId,
                    isLocked: block.isLocked,
                    isAfterHours: block.isAfterHours,
                  };
                }
                return s;
              }),
              updatedAt,
            };
          }
          
          return { ...p, blocks: p.blocks.map(b => b.id === block.id ? block : b), updatedAt };
        }),
      };
    }
      
    case 'DELETE_BLOCK': {
      const { planId, blockId, scope } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          
          const block = p.blocks.find(b => b.id === blockId);
          if (!block) return p;
          
          if (!scope || scope === 'this') {
            return { ...p, blocks: p.blocks.filter(b => b.id !== blockId), updatedAt };
          }
          
          if (scope === 'thisAndFuture' && block.recurrenceSeriesId) {
            const remainingSeriesBlocks = p.blocks.filter(b => 
              b.recurrenceSeriesId === block.recurrenceSeriesId && b.week < block.week
            );
            
            const shouldRemoveSeries = remainingSeriesBlocks.length === 0;
            
            return {
              ...p,
              blocks: p.blocks.filter(b => 
                !(b.recurrenceSeriesId === block.recurrenceSeriesId && b.week >= block.week)
              ),
              recurrenceSeries: shouldRemoveSeries 
                ? p.recurrenceSeries.filter(s => s.id !== block.recurrenceSeriesId)
                : p.recurrenceSeries.map(s => {
                    if (s.id === block.recurrenceSeriesId) {
                      return {
                        ...s,
                        pattern: {
                          ...s.pattern,
                          endWeek: block.week - 1,
                        },
                      };
                    }
                    return s;
                  }),
              updatedAt,
            };
          }
          
          if (scope === 'all' && block.recurrenceSeriesId) {
            return {
              ...p,
              blocks: p.blocks.filter(b => b.recurrenceSeriesId !== block.recurrenceSeriesId),
              recurrenceSeries: p.recurrenceSeries.filter(s => s.id !== block.recurrenceSeriesId),
              updatedAt,
            };
          }
          
          return { ...p, blocks: p.blocks.filter(b => b.id !== blockId), updatedAt };
        }),
      };
    }

    case 'ADD_RECURRENCE_SERIES': {
      const { planId, series } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, recurrenceSeries: [...p.recurrenceSeries, series], updatedAt }
            : p
        ),
      };
    }

    case 'UPDATE_RECURRENCE_SERIES': {
      const { planId, series } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, recurrenceSeries: p.recurrenceSeries.map(s => s.id === series.id ? series : s), updatedAt }
            : p
        ),
      };
    }

    case 'DELETE_RECURRENCE_SERIES': {
      const { planId, seriesId } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { 
                ...p, 
                recurrenceSeries: p.recurrenceSeries.filter(s => s.id !== seriesId),
                blocks: p.blocks.filter(b => b.recurrenceSeriesId !== seriesId),
                updatedAt,
              }
            : p
        ),
      };
    }
      
    case 'COPY_WEEK': {
      const { planId, fromWeek, toWeek } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          
          const existingToWeekBlockIds = new Set(
            p.blocks.filter(b => b.week === toWeek).map(b => `${b.day}-${b.startMinutes}`)
          );
          
          const blocksFromWeek = p.blocks.filter(b => b.week === fromWeek);
          const newBlocks: PlacedBlock[] = blocksFromWeek
            .filter(b => !existingToWeekBlockIds.has(`${b.day}-${b.startMinutes}`))
            .map(b => ({
              ...b,
              id: uuidv4(),
              week: toWeek,
              recurrenceSeriesId: null,
              isRecurrenceException: false,
            }));
          
          return { ...p, blocks: [...p.blocks, ...newBlocks], updatedAt };
        }),
      };
    }
      
    case 'RESET_WEEK': {
      const { planId, week } = action.payload;
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, blocks: p.blocks.filter(b => b.week !== week), updatedAt }
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

    case 'ADD_PARTNER_ORG':
      return {
        ...state,
        partners: {
          ...state.partners,
          orgs: [...state.partners.orgs, action.payload],
        },
      };

    case 'UPDATE_PARTNER_ORG':
      return {
        ...state,
        partners: {
          ...state.partners,
          orgs: state.partners.orgs.map(o => 
            o.id === action.payload.id ? action.payload : o
          ),
        },
      };

    case 'DELETE_PARTNER_ORG':
      return {
        ...state,
        partners: {
          ...state.partners,
          orgs: state.partners.orgs.filter(o => o.id !== action.payload),
          contacts: state.partners.contacts.filter(c => c.orgId !== action.payload),
          engagements: state.partners.engagements.filter(e => e.orgId !== action.payload),
        },
      };

    case 'ADD_PARTNER_CONTACT':
      return {
        ...state,
        partners: {
          ...state.partners,
          contacts: [...state.partners.contacts, action.payload],
        },
      };

    case 'UPDATE_PARTNER_CONTACT':
      return {
        ...state,
        partners: {
          ...state.partners,
          contacts: state.partners.contacts.map(c => 
            c.id === action.payload.id ? action.payload : c
          ),
        },
      };

    case 'DELETE_PARTNER_CONTACT':
      return {
        ...state,
        partners: {
          ...state.partners,
          contacts: state.partners.contacts.filter(c => c.id !== action.payload),
          engagements: state.partners.engagements.map(e => ({
            ...e,
            contactIds: e.contactIds.filter(id => id !== action.payload),
          })),
        },
      };

    case 'ADD_PARTNER_ENGAGEMENT':
      return {
        ...state,
        partners: {
          ...state.partners,
          engagements: [...state.partners.engagements, action.payload],
        },
      };

    case 'UPDATE_PARTNER_ENGAGEMENT':
      return {
        ...state,
        partners: {
          ...state.partners,
          engagements: state.partners.engagements.map(e => 
            e.id === action.payload.id ? action.payload : e
          ),
        },
      };

    case 'DELETE_PARTNER_ENGAGEMENT':
      return {
        ...state,
        partners: {
          ...state.partners,
          engagements: state.partners.engagements.filter(e => e.id !== action.payload),
        },
        templates: state.templates.filter(t => t.engagementId !== action.payload),
      };

    case 'PUBLISH_PLAN': {
      const { planId, publicId, timestamp } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { 
                ...p, 
                isPublished: true, 
                publishedAt: timestamp,
                publicId: p.publicId || publicId,
                updatedAt: timestamp,
              } 
            : p
        ),
      };
    }

    case 'UNPUBLISH_PLAN': {
      const { planId, timestamp } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, isPublished: false, updatedAt: timestamp } 
            : p
        ),
      };
    }

    case 'REGENERATE_PUBLIC_ID': {
      const { planId, newPublicId, timestamp } = action.payload;
      return {
        ...state,
        plans: state.plans.map(p => 
          p.id === planId 
            ? { ...p, publicId: newPublicId, updatedAt: timestamp } 
            : p
        ),
      };
    }

    case 'ASSIGN_BLOCK_TEMPLATE': {
      const { planId, blockId, templateId, timestamp } = action.payload;
      const template = templateId ? state.templates.find(t => t.id === templateId) : null;
      const countsTowardGoldenRule = template?.countsTowardGoldenRule ?? false;
      const goldenRuleBucketId = template?.goldenRuleBucketId ?? null;
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          return {
            ...p,
            updatedAt: timestamp,
            blocks: p.blocks.map(b => {
              if (b.id !== blockId) return b;
              return {
                ...b,
                templateId,
                countsTowardGoldenRule,
                goldenRuleBucketId,
              };
            }),
          };
        }),
      };
    }

    case 'ASSIGN_MULTIPLE_BLOCKS_TEMPLATE': {
      const { planId, blockIds, templateId, timestamp } = action.payload;
      const template = templateId ? state.templates.find(t => t.id === templateId) : null;
      const countsTowardGoldenRule = template?.countsTowardGoldenRule ?? false;
      const goldenRuleBucketId = template?.goldenRuleBucketId ?? null;
      const blockIdSet = new Set(blockIds);
      return {
        ...state,
        plans: state.plans.map(p => {
          if (p.id !== planId) return p;
          return {
            ...p,
            updatedAt: timestamp,
            blocks: p.blocks.map(b => {
              if (!blockIdSet.has(b.id)) return b;
              return {
                ...b,
                templateId,
                countsTowardGoldenRule,
                goldenRuleBucketId,
              };
            }),
          };
        }),
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
  const saveTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    const { state: loadedState, error } = loadState();
    if (error) {
      setLoadError(error);
    }
    dispatch({ type: 'LOAD_STATE', payload: loadedState });
    setInitialized(true);
  }, []);
  
  useEffect(() => {
    if (!initialized) return;
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      saveState(state);
    }, 500);
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
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
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 p-3 text-center text-sm z-50">
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
