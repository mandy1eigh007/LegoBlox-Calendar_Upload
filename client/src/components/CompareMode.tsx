import { useState, useMemo } from 'react';
import { useStore } from '@/state/store';
import { Plan, PlacedBlock, DAYS, Day, DEFAULT_RESOURCES } from '@/state/types';
import { minutesToTimeDisplay, SLOT_HEIGHT_PX, SLOT_MINUTES } from '@/lib/time';
import { X, AlertTriangle } from 'lucide-react';

interface Conflict {
  resource: string;
  day: Day;
  week: number;
  startMinutes: number;
  endMinutes: number;
  plans: { planId: string; planName: string; blockTitle: string }[];
}

interface CompareModeProps {
  currentPlanId: string;
  currentWeek: number;
  onClose: () => void;
}

export function CompareMode({ currentPlanId, currentWeek, onClose }: CompareModeProps) {
  const { state } = useStore();
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([currentPlanId]);
  const [displayWeek, setDisplayWeek] = useState(currentWeek);

  const selectedPlans = state.plans.filter(p => selectedPlanIds.includes(p.id));
  const maxWeeks = Math.max(...selectedPlans.map(p => p.settings.weeks), 1);

  const togglePlan = (planId: string) => {
    if (selectedPlanIds.includes(planId)) {
      if (selectedPlanIds.length > 1) {
        setSelectedPlanIds(prev => prev.filter(id => id !== planId));
      }
    } else {
      setSelectedPlanIds(prev => [...prev, planId]);
    }
  };

  const conflicts = useMemo(() => {
    const result: Conflict[] = [];
    if (selectedPlans.length < 2) return result;

    const resourceBlocks: Map<string, { planId: string; planName: string; block: PlacedBlock }[]> = new Map();

    for (const plan of selectedPlans) {
      for (const block of plan.blocks) {
        const blockResource = block.resource || block.location;
        if (block.week !== displayWeek || !blockResource) continue;
        
        const key = `${block.day}-${blockResource}`;
        if (!resourceBlocks.has(key)) {
          resourceBlocks.set(key, []);
        }
        resourceBlocks.get(key)!.push({ planId: plan.id, planName: plan.settings.name, block });
      }
    }

    for (const [key, blocks] of Array.from(resourceBlocks.entries())) {
      if (blocks.length < 2) continue;

      for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i];
          const b = blocks[j];
          
          if (a.planId === b.planId) continue;

          const aEnd = a.block.startMinutes + a.block.durationMinutes;
          const bEnd = b.block.startMinutes + b.block.durationMinutes;
          
          const overlaps = a.block.startMinutes < bEnd && aEnd > b.block.startMinutes;
          
          if (overlaps) {
            const overlapStart = Math.max(a.block.startMinutes, b.block.startMinutes);
            const overlapEnd = Math.min(aEnd, bEnd);
            
            const existingConflict = result.find(
              c => c.resource === a.block.location && 
                   c.day === a.block.day && 
                   c.startMinutes === overlapStart &&
                   c.endMinutes === overlapEnd
            );
            
            if (existingConflict) {
              const template2 = state.templates.find(t => t.id === b.block.templateId);
              const bEntry = { planId: b.planId, planName: b.planName, blockTitle: b.block.titleOverride || template2?.title || 'Untitled' };
              if (!existingConflict.plans.some(p => p.planId === b.planId && p.blockTitle === bEntry.blockTitle)) {
                existingConflict.plans.push(bEntry);
              }
            } else {
              const template1 = state.templates.find(t => t.id === a.block.templateId);
              const template2 = state.templates.find(t => t.id === b.block.templateId);
              const aResource = a.block.resource || a.block.location;
              
              result.push({
                resource: aResource,
                day: a.block.day,
                week: displayWeek,
                startMinutes: overlapStart,
                endMinutes: overlapEnd,
                plans: [
                  { planId: a.planId, planName: a.planName, blockTitle: a.block.titleOverride || template1?.title || 'Untitled' },
                  { planId: b.planId, planName: b.planName, blockTitle: b.block.titleOverride || template2?.title || 'Untitled' },
                ],
              });
            }
          }
        }
      }
    }

    return result;
  }, [selectedPlans, displayWeek, state.templates]);

  const getBlocksForPlanDayWeek = (plan: Plan, day: Day, week: number) => {
    return plan.blocks.filter(b => b.day === day && b.week === week);
  };

  const isBlockConflicting = (planId: string, block: PlacedBlock) => {
    const blockResource = block.resource || block.location;
    return conflicts.some(c => 
      c.plans.some(p => p.planId === planId) &&
      c.day === block.day &&
      c.resource === blockResource &&
      block.startMinutes < c.endMinutes &&
      (block.startMinutes + block.durationMinutes) > c.startMinutes
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-lg">Compare Calendars</h1>
          {conflicts.length > 0 && (
            <span className="flex items-center gap-1 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {conflicts.length} resource conflict{conflicts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">Week:</span>
            <select
              value={displayWeek}
              onChange={e => setDisplayWeek(parseInt(e.target.value))}
              className="px-3 py-1 border rounded text-sm"
              data-testid="compare-week-selector"
            >
              {Array.from({ length: maxWeeks }, (_, i) => i + 1).map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid="close-compare-mode"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-48 border-r bg-gray-50 p-4 overflow-auto">
          <h3 className="font-medium text-sm mb-3">Select Plans to Compare</h3>
          <div className="space-y-2">
            {state.plans.map(plan => (
              <label
                key={plan.id}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedPlanIds.includes(plan.id)}
                  onChange={() => togglePlan(plan.id)}
                  data-testid={`compare-plan-${plan.id}`}
                />
                <span className="truncate">{plan.settings.name}</span>
              </label>
            ))}
          </div>

          {conflicts.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-sm mb-2 text-red-600">Conflicts</h3>
              <div className="space-y-2">
                {conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-red-50 border border-red-200 rounded text-xs"
                    data-testid={`conflict-${idx}`}
                  >
                    <p className="font-medium">{conflict.resource}</p>
                    <p className="text-gray-600">
                      {conflict.day}, {minutesToTimeDisplay(conflict.startMinutes)} - {minutesToTimeDisplay(conflict.endMinutes)}
                    </p>
                    <div className="mt-1 text-gray-500">
                      {conflict.plans.map((p, i) => (
                        <p key={i}>{p.planName}: {p.blockTitle}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium text-sm mb-2">Resources</h3>
            <div className="text-xs text-gray-600 space-y-1">
              {DEFAULT_RESOURCES.map(r => (
                <p key={r}>{r}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-4" style={{ minWidth: selectedPlans.length * 500 }}>
            {selectedPlans.map(plan => {
              const dayStart = plan.settings.dayStartMinutes;
              const dayEnd = plan.settings.dayEndMinutes;
              const totalSlots = (dayEnd - dayStart) / SLOT_MINUTES;
              const gridHeight = totalSlots * SLOT_HEIGHT_PX;

              return (
                <div key={plan.id} className="flex-1 min-w-[450px]">
                  <h3 className="font-medium text-sm mb-2 px-2">{plan.settings.name}</h3>
                  <div className="border rounded bg-white">
                    <div className="flex border-b">
                      <div className="w-16 flex-shrink-0 p-2 text-xs font-medium text-gray-500">Time</div>
                      {DAYS.map(day => (
                        <div key={day} className="flex-1 p-2 text-xs font-medium text-center border-l">
                          {day.slice(0, 3)}
                        </div>
                      ))}
                    </div>
                    <div className="flex" style={{ height: gridHeight }}>
                      <div className="w-16 flex-shrink-0 relative">
                        {Array.from({ length: totalSlots }, (_, i) => {
                          const minutes = dayStart + i * SLOT_MINUTES;
                          const showLabel = minutes % 60 === 0;
                          return showLabel ? (
                            <div
                              key={i}
                              className="absolute text-xs text-gray-400 pr-2 text-right w-full"
                              style={{ top: i * SLOT_HEIGHT_PX - 6 }}
                            >
                              {minutesToTimeDisplay(minutes)}
                            </div>
                          ) : null;
                        })}
                      </div>
                      {DAYS.map(day => {
                        const blocks = getBlocksForPlanDayWeek(plan, day, displayWeek);
                        return (
                          <div key={day} className="flex-1 border-l relative bg-gray-50">
                            {Array.from({ length: totalSlots }, (_, i) => (
                              <div
                                key={i}
                                className="absolute w-full border-b border-gray-100"
                                style={{ top: i * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
                              />
                            ))}
                            {blocks.map(block => {
                              const template = state.templates.find(t => t.id === block.templateId);
                              const top = ((block.startMinutes - dayStart) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
                              const height = (block.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT_PX;
                              const hasConflict = isBlockConflicting(plan.id, block);
                              
                              return (
                                <div
                                  key={block.id}
                                  className={`absolute left-0.5 right-0.5 rounded text-xs overflow-hidden ${
                                    hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''
                                  }`}
                                  style={{
                                    top,
                                    height: Math.max(height, 20),
                                    backgroundColor: template?.colorHex || '#6B7280',
                                    color: 'white',
                                  }}
                                  title={`${block.titleOverride || template?.title || 'Block'} @ ${block.location || 'No location'}`}
                                >
                                  <div className="p-1 truncate font-medium">
                                    {block.titleOverride || template?.title || 'Block'}
                                  </div>
                                  {block.location && height > 30 && (
                                    <div className="px-1 truncate text-white/80 text-[10px]">
                                      {block.location}
                                    </div>
                                  )}
                                  {hasConflict && (
                                    <div className="absolute top-0.5 right-0.5">
                                      <AlertTriangle className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
