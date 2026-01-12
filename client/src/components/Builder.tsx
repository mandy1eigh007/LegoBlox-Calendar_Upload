import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, PlacedBlock, Day, DAYS, AllowedDuration } from '@/state/types';
import { BlockLibrary } from './BlockLibrary';
import { WeekGrid } from './WeekGrid';
import { BlockEditPanel } from './BlockEditPanel';
import { GoldenRuleTotals } from './GoldenRuleTotals';
import { PlanEditor } from './PlanEditor';
import { ExportImportPanel } from './ExportImportPanel';
import { PrintView } from './PrintView';
import { ConfirmModal } from './Modal';
import { findCollisions, findNextAvailableSlot, wouldFitInDay } from '@/lib/collision';
import { checkGoldenRuleLimit } from '@/lib/goldenRule';
import { timeToMinutes, minutesToTime, snapToSlot, formatTimeDisplay, getEndTime } from '@/lib/time';
import { v4 as uuidv4 } from 'uuid';

export function Builder() {
  const { planId } = useParams<{ planId: string }>();
  const [, navigate] = useLocation();
  const { state, dispatch } = useStore();
  
  const plan = state.plans.find(p => p.id === planId);
  
  const [currentWeek, setCurrentWeek] = useState(1);
  const [autoPlace, setAutoPlace] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [copyResult, setCopyResult] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'template' | 'placed-block'; data: BlockTemplate | PlacedBlock } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (copyResult) {
      const timer = setTimeout(() => setCopyResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [copyResult]);

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Plan not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="go-back-button"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const { settings } = plan;
  const enabledDays = DAYS.filter(day => settings.enabledDays.includes(day));

  const calculateDropTime = (dayIndex: number, clientY: number, gridElement: Element): string => {
    const rect = gridElement.getBoundingClientRect();
    const headerHeight = 41;
    const slotHeight = 24;
    const relativeY = clientY - rect.top - headerHeight;
    const slotIndex = Math.floor(relativeY / slotHeight);
    const dayStartMinutes = timeToMinutes(settings.dayStartTime);
    const rawMinutes = dayStartMinutes + (slotIndex * 15);
    const snappedMinutes = snapToSlot(rawMinutes, 15);
    return minutesToTime(Math.max(snappedMinutes, dayStartMinutes));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;
    
    if (activeData?.type === 'template') {
      setDraggedItem({ type: 'template', data: activeData.template });
    } else if (activeData?.type === 'placed-block') {
      setDraggedItem({ type: 'placed-block', data: activeData.block });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedItem(null);
    const { active, over } = event;
    
    if (!over) return;
    
    const overData = over.data.current;
    if (!overData?.day) return;
    
    const day = overData.day as Day;
    const activeData = active.data.current;
    
    const gridElement = document.querySelector('[class*="flex-1 overflow-auto"]');
    if (!gridElement) return;
    
    const pointerY = (event.activatorEvent as PointerEvent)?.clientY || 0;
    const deltaY = event.delta.y;
    const finalY = pointerY + deltaY;
    
    let dropTime = calculateDropTime(enabledDays.indexOf(day), finalY, gridElement);
    
    if (activeData?.type === 'template') {
      const template = activeData.template as BlockTemplate;
      placeNewBlock(template, day, dropTime);
    } else if (activeData?.type === 'placed-block') {
      const block = activeData.block as PlacedBlock;
      moveBlock(block, day, dropTime);
    }
  };

  const placeNewBlock = (template: BlockTemplate, day: Day, startTime: string) => {
    const duration = template.defaultDurationMin;
    
    if (!wouldFitInDay(startTime, duration, settings.dayEndTime)) {
      setErrorMessage(`Block would extend beyond day end time.`);
      return;
    }
    
    let collisions = findCollisions(plan.blocks, currentWeek, day, startTime, duration);
    
    if (collisions.length > 0 && autoPlace) {
      const nextSlot = findNextAvailableSlot(
        plan.blocks, currentWeek, day, startTime, duration,
        settings.dayStartTime, settings.dayEndTime, settings.slotMin
      );
      
      if (nextSlot) {
        startTime = nextSlot;
        collisions = [];
      } else {
        setErrorMessage('No open slot available that fits.');
        return;
      }
    }
    
    if (collisions.length > 0) {
      const conflict = collisions[0];
      const conflictTitle = state.templates.find(t => t.id === conflict.block.templateId)?.title || 'Unknown';
      setErrorMessage(`Cannot place. Conflicts with: ${conflictTitle} ${formatTimeDisplay(conflict.startTime)}-${formatTimeDisplay(conflict.endTime)}`);
      return;
    }
    
    const goldenRuleCheck = checkGoldenRuleLimit(plan, state.templates, template.id, duration);
    
    if (!goldenRuleCheck.allowed) {
      setErrorMessage(goldenRuleCheck.message);
      return;
    }
    
    const doPlace = () => {
      const block: PlacedBlock = {
        id: uuidv4(),
        templateId: template.id,
        week: currentWeek,
        day,
        startTime,
        durationMin: duration,
      };
      
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
    };
    
    if (goldenRuleCheck.warning) {
      setWarningMessage({ message: goldenRuleCheck.message, onConfirm: doPlace });
    } else {
      doPlace();
    }
  };

  const moveBlock = (block: PlacedBlock, newDay: Day, newStartTime: string) => {
    const duration = block.durationMin;
    
    if (!wouldFitInDay(newStartTime, duration, settings.dayEndTime)) {
      setErrorMessage(`Block would extend beyond day end time.`);
      return;
    }
    
    let collisions = findCollisions(plan.blocks, currentWeek, newDay, newStartTime, duration, block.id);
    
    if (collisions.length > 0 && autoPlace) {
      const nextSlot = findNextAvailableSlot(
        plan.blocks, currentWeek, newDay, newStartTime, duration,
        settings.dayStartTime, settings.dayEndTime, settings.slotMin, block.id
      );
      
      if (nextSlot) {
        newStartTime = nextSlot;
        collisions = [];
      } else {
        setErrorMessage('No open slot available that fits.');
        return;
      }
    }
    
    if (collisions.length > 0) {
      const conflict = collisions[0];
      const conflictTitle = state.templates.find(t => t.id === conflict.block.templateId)?.title || 'Unknown';
      setErrorMessage(`Cannot place. Conflicts with: ${conflictTitle} ${formatTimeDisplay(conflict.startTime)}-${formatTimeDisplay(conflict.endTime)}`);
      return;
    }
    
    const updatedBlock: PlacedBlock = {
      ...block,
      week: currentWeek,
      day: newDay,
      startTime: newStartTime,
    };
    
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
  };

  const handleBlockUpdate = (updatedBlock: PlacedBlock) => {
    const template = state.templates.find(t => t.id === updatedBlock.templateId);
    if (!template) return;
    
    const originalBlock = plan.blocks.find(b => b.id === updatedBlock.id);
    if (!originalBlock) return;
    
    if (updatedBlock.durationMin !== originalBlock.durationMin) {
      if (!wouldFitInDay(updatedBlock.startTime, updatedBlock.durationMin, settings.dayEndTime)) {
        setErrorMessage('New duration would extend beyond day end time.');
        return;
      }
      
      const collisions = findCollisions(
        plan.blocks, updatedBlock.week, updatedBlock.day, 
        updatedBlock.startTime, updatedBlock.durationMin, updatedBlock.id
      );
      
      if (collisions.length > 0) {
        setErrorMessage('New duration would cause overlap with existing block.');
        return;
      }
      
      const goldenRuleCheck = checkGoldenRuleLimit(
        plan, state.templates, template.id, updatedBlock.durationMin, updatedBlock.id
      );
      
      if (!goldenRuleCheck.allowed) {
        setErrorMessage(goldenRuleCheck.message);
        return;
      }
      
      if (goldenRuleCheck.warning) {
        setWarningMessage({
          message: goldenRuleCheck.message,
          onConfirm: () => {
            dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
            setSelectedBlockId(null);
          },
        });
        return;
      }
    }
    
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
    setSelectedBlockId(null);
  };

  const handleBlockDelete = () => {
    if (selectedBlockId) {
      dispatch({ type: 'DELETE_BLOCK', payload: { planId: plan.id, blockId: selectedBlockId } });
      setSelectedBlockId(null);
    }
  };

  const handleCopyWeek = () => {
    if (currentWeek >= settings.weeks) {
      setErrorMessage('Cannot copy to next week - already at last week.');
      return;
    }
    
    const nextWeek = currentWeek + 1;
    const blocksToCheck = plan.blocks.filter(b => b.week === currentWeek);
    const existingNextWeekBlocks = plan.blocks.filter(b => b.week === nextWeek);
    
    const skipped: string[] = [];
    const copied: PlacedBlock[] = [];
    
    for (const block of blocksToCheck) {
      const template = state.templates.find(t => t.id === block.templateId);
      const title = template?.title || 'Unknown';
      
      const collisions = findCollisions(
        [...existingNextWeekBlocks, ...copied],
        nextWeek, block.day, block.startTime, block.durationMin
      );
      
      if (collisions.length > 0) {
        skipped.push(`${title} (${block.day} ${formatTimeDisplay(block.startTime)}): overlaps with existing block`);
        continue;
      }
      
      if (template) {
        const tempPlan = { ...plan, blocks: [...plan.blocks, ...copied] };
        const goldenRuleCheck = checkGoldenRuleLimit(tempPlan, state.templates, template.id, block.durationMin);
        
        if (!goldenRuleCheck.allowed) {
          skipped.push(`${title} (${block.day} ${formatTimeDisplay(block.startTime)}): exceeds Golden Rule hours`);
          continue;
        }
      }
      
      copied.push({
        ...block,
        id: uuidv4(),
        week: nextWeek,
      });
    }
    
    if (copied.length > 0) {
      for (const newBlock of copied) {
        dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block: newBlock } });
      }
    }
    
    if (skipped.length > 0) {
      setCopyResult(`Copied ${copied.length} blocks. Skipped ${skipped.length}:\n${skipped.join('\n')}`);
    } else {
      setCopyResult(`Copied ${copied.length} blocks to Week ${nextWeek}.`);
    }
    
    setCurrentWeek(nextWeek);
  };

  const handleResetWeek = () => {
    dispatch({ type: 'RESET_WEEK', payload: { planId: plan.id, week: currentWeek } });
    setShowResetConfirm(false);
    setSelectedBlockId(null);
  };

  const selectedBlock = selectedBlockId ? plan.blocks.find(b => b.id === selectedBlockId) : null;
  const selectedTemplate = selectedBlock ? state.templates.find(t => t.id === selectedBlock.templateId) : undefined;

  if (showPrint) {
    return (
      <PrintView
        plan={plan}
        currentWeek={currentWeek}
        templates={state.templates}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="back-to-plans"
            >
              Back
            </button>
            <h1 className="font-semibold text-lg">{plan.settings.name}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">Week:</span>
              <select
                value={currentWeek}
                onChange={e => setCurrentWeek(parseInt(e.target.value))}
                className="px-3 py-1 border rounded text-sm"
                data-testid="week-selector"
              >
                {Array.from({ length: settings.weeks }, (_, i) => i + 1).map(week => (
                  <option key={week} value={week}>Week {week}</option>
                ))}
              </select>
            </div>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoPlace}
                onChange={e => setAutoPlace(e.target.checked)}
                data-testid="auto-place-toggle"
              />
              Auto-place
            </label>
            
            <button
              onClick={handleCopyWeek}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="copy-week-button"
            >
              Copy to Next Week
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
              data-testid="reset-week-button"
            >
              Reset Week
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="export-button"
            >
              Export
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="print-view-button"
            >
              Print View
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="edit-settings-button"
            >
              Edit Settings
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700" data-testid="error-message">
            {errorMessage}
          </div>
        )}

        {copyResult && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700 whitespace-pre-line" data-testid="copy-result">
            {copyResult}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 flex-shrink-0">
            <BlockLibrary />
          </div>
          
          <WeekGrid
            plan={plan}
            currentWeek={currentWeek}
            templates={state.templates}
            onBlockClick={(block) => setSelectedBlockId(block.id)}
            selectedBlockId={selectedBlockId}
          />
          
          {selectedBlock ? (
            <BlockEditPanel
              block={selectedBlock}
              template={selectedTemplate}
              onUpdate={handleBlockUpdate}
              onDelete={handleBlockDelete}
              onClose={() => setSelectedBlockId(null)}
            />
          ) : (
            <div className="w-72 flex-shrink-0">
              <GoldenRuleTotals plan={plan} templates={state.templates} />
            </div>
          )}
        </div>

        <DragOverlay>
          {draggedItem && draggedItem.type === 'template' && (
            <div
              className="p-3 rounded border shadow-lg opacity-90"
              style={{
                backgroundColor: (draggedItem.data as BlockTemplate).colorHex + '40',
                borderColor: (draggedItem.data as BlockTemplate).colorHex,
              }}
            >
              <p className="text-sm font-medium">{(draggedItem.data as BlockTemplate).title}</p>
            </div>
          )}
          {draggedItem && draggedItem.type === 'placed-block' && (
            <div
              className="p-2 rounded shadow-lg opacity-90"
              style={{
                backgroundColor: state.templates.find(t => t.id === (draggedItem.data as PlacedBlock).templateId)?.colorHex || '#6B7280',
                color: 'white',
              }}
            >
              <p className="text-xs font-medium">
                {(draggedItem.data as PlacedBlock).titleOverride || 
                  state.templates.find(t => t.id === (draggedItem.data as PlacedBlock).templateId)?.title || 
                  'Block'}
              </p>
            </div>
          )}
        </DragOverlay>
      </div>

      <PlanEditor plan={plan} open={showSettings} onClose={() => setShowSettings(false)} />
      <ExportImportPanel plan={plan} open={showExport} onClose={() => setShowExport(false)} />
      
      <ConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetWeek}
        title="Reset Week"
        message={`Are you sure you want to clear all blocks from Week ${currentWeek}? This action cannot be undone.`}
        confirmText="Reset"
      />

      <ConfirmModal
        open={warningMessage !== null}
        onClose={() => setWarningMessage(null)}
        onConfirm={() => {
          warningMessage?.onConfirm();
          setWarningMessage(null);
        }}
        title="Golden Rule Warning"
        message={warningMessage?.message || ''}
        confirmText="Proceed"
      />
    </DndContext>
  );
}
