import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, PlacedBlock, Day, DAYS, ApplyScope } from '@/state/types';
import { BlockLibrary } from './BlockLibrary';
import { WeekGrid } from './WeekGrid';
import { BlockEditPanel } from './BlockEditPanel';
import { GoldenRuleTotals } from './GoldenRuleTotals';
import { PlanEditor } from './PlanEditor';
import { ExportImportPanel } from './ExportImportPanel';
import { PrintView } from './PrintView';
import { ConfirmModal } from './Modal';
import { findTimeConflicts, wouldFitInDay } from '@/lib/collision';
import { 
  SLOT_HEIGHT_PX, 
  SLOT_MINUTES,
  minutesToTimeDisplay,
  getEndMinutes,
  snapToSlot,
  clampMinutes
} from '@/lib/time';
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
  const [draggedItem, setDraggedItem] = useState<{ type: 'template' | 'placed-block'; data: BlockTemplate | PlacedBlock } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const calculateDropMinutes = (clientY: number, gridElement: Element): number => {
    const rect = gridElement.getBoundingClientRect();
    const headerHeight = 41;
    const scrollTop = gridElement.scrollTop;
    const yWithinGrid = (clientY - rect.top - headerHeight) + scrollTop;
    const slotIndex = Math.round(yWithinGrid / SLOT_HEIGHT_PX);
    const minutesFromStart = slotIndex * SLOT_MINUTES;
    const rawMinutes = settings.dayStartMinutes + minutesFromStart;
    const snappedMinutes = snapToSlot(rawMinutes, SLOT_MINUTES);
    return clampMinutes(snappedMinutes, settings.dayStartMinutes, settings.dayEndMinutes - 15);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!gridRef.current) return;
    const minutes = calculateDropMinutes(e.clientY, gridRef.current);
    setHoverMinutes(minutes);
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
    
    const gridElement = document.querySelector('[data-testid="week-grid"]');
    if (!gridElement) return;
    
    const pointerY = (event.activatorEvent as PointerEvent)?.clientY || 0;
    const deltaY = event.delta.y;
    const finalY = pointerY + deltaY;
    
    const dropMinutes = calculateDropMinutes(finalY, gridElement);
    
    if (activeData?.type === 'template') {
      const template = activeData.template as BlockTemplate;
      placeNewBlock(template, day, dropMinutes);
    } else if (activeData?.type === 'placed-block') {
      const block = activeData.block as PlacedBlock;
      moveBlock(block, day, dropMinutes);
    }
  };

  const placeNewBlock = (template: BlockTemplate, day: Day, startMinutes: number) => {
    const duration = template.defaultDurationMinutes;
    
    if (!wouldFitInDay(startMinutes, duration, settings.dayEndMinutes)) {
      setErrorMessage(`Block would extend beyond ${minutesToTimeDisplay(settings.dayEndMinutes)}.`);
      return;
    }
    
    const conflicts = findTimeConflicts(plan.blocks, currentWeek, day, startMinutes, duration);
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      const conflictTitle = state.templates.find(t => t.id === conflicts[0].templateId)?.title || 'Unknown';
      setErrorMessage(`Cannot place. Conflicts with: ${conflictTitle} at ${minutesToTimeDisplay(conflicts[0].startMinutes)}`);
      return;
    }
    
    const block: PlacedBlock = {
      id: uuidv4(),
      templateId: template.id,
      week: currentWeek,
      day,
      startMinutes,
      durationMinutes: duration,
      titleOverride: '',
      location: template.defaultLocation,
      notes: template.defaultNotes,
      countsTowardGoldenRule: template.countsTowardGoldenRule,
      goldenRuleBucketId: template.goldenRuleBucketId,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
    };
    
    dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
  };

  const moveBlock = (block: PlacedBlock, newDay: Day, newStartMinutes: number) => {
    const duration = block.durationMinutes;
    
    if (!wouldFitInDay(newStartMinutes, duration, settings.dayEndMinutes)) {
      setErrorMessage(`Block would extend beyond ${minutesToTimeDisplay(settings.dayEndMinutes)}.`);
      return;
    }
    
    const conflicts = findTimeConflicts(plan.blocks, currentWeek, newDay, newStartMinutes, duration, block.id);
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      const conflictTitle = state.templates.find(t => t.id === conflicts[0].templateId)?.title || 'Unknown';
      setErrorMessage(`Cannot move. Conflicts with: ${conflictTitle}`);
      return;
    }
    
    const updatedBlock: PlacedBlock = {
      ...block,
      week: currentWeek,
      day: newDay,
      startMinutes: newStartMinutes,
    };
    
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
  };

  const handleBlockResize = (blockId: string, newDuration: number) => {
    const block = plan.blocks.find(b => b.id === blockId);
    if (!block) return;
    
    if (newDuration % 15 !== 0) return;
    
    if (!wouldFitInDay(block.startMinutes, newDuration, settings.dayEndMinutes)) {
      return;
    }
    
    const conflicts = findTimeConflicts(
      plan.blocks, block.week, block.day,
      block.startMinutes, newDuration, block.id
    );
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      return;
    }
    
    const updatedBlock: PlacedBlock = { ...block, durationMinutes: newDuration };
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
  };

  const handleBlockUpdate = (updatedBlock: PlacedBlock, scope?: ApplyScope) => {
    if (updatedBlock.durationMinutes % 15 !== 0) {
      setErrorMessage('Duration must be a multiple of 15 minutes.');
      return;
    }
    
    if (!wouldFitInDay(updatedBlock.startMinutes, updatedBlock.durationMinutes, settings.dayEndMinutes)) {
      setErrorMessage(`Duration would extend past ${minutesToTimeDisplay(settings.dayEndMinutes)}.`);
      return;
    }
    
    const conflicts = findTimeConflicts(
      plan.blocks, updatedBlock.week, updatedBlock.day, 
      updatedBlock.startMinutes, updatedBlock.durationMinutes, updatedBlock.id
    );
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      setErrorMessage('New time/duration would cause overlap with existing block.');
      return;
    }
    
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock, scope } });
    setSelectedBlockId(null);
  };

  const handleBlockDelete = (scope?: ApplyScope) => {
    if (selectedBlockId) {
      dispatch({ type: 'DELETE_BLOCK', payload: { planId: plan.id, blockId: selectedBlockId, scope } });
      setSelectedBlockId(null);
    }
  };

  const handleBlockDuplicate = () => {
    if (!selectedBlockId) return;
    
    const block = plan.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;
    
    const newBlock: PlacedBlock = {
      ...block,
      id: uuidv4(),
      recurrenceSeriesId: null,
      isRecurrenceException: false,
    };
    
    dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block: newBlock } });
  };

  const handleCreateRecurrence = (blocks: PlacedBlock[]) => {
    if (selectedBlockId) {
      dispatch({ type: 'DELETE_BLOCK', payload: { planId: plan.id, blockId: selectedBlockId } });
    }
    
    for (const block of blocks) {
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
    }
    
    setSelectedBlockId(null);
  };

  const handleCopyWeek = () => {
    if (currentWeek >= settings.weeks) {
      setErrorMessage('Cannot copy to next week - already at last week.');
      return;
    }
    
    dispatch({ type: 'COPY_WEEK', payload: { planId: plan.id, fromWeek: currentWeek, toWeek: currentWeek + 1 } });
    setCurrentWeek(currentWeek + 1);
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
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between flex-wrap gap-2">
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
          
          <div className="flex items-center gap-2 flex-wrap">
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
            
            <label className="flex items-center gap-1 text-sm">
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

        {showDiagnostics && (
          <div className="bg-gray-100 border-b px-4 py-2 text-xs font-mono">
            Diagnostics: slotHeightPx={SLOT_HEIGHT_PX}, slotMinutes={SLOT_MINUTES}, 
            hoverMinutes={hoverMinutes !== null ? `${hoverMinutes} (${minutesToTimeDisplay(hoverMinutes)})` : 'none'}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden" onMouseMove={handleMouseMove} ref={gridRef}>
          <div className="w-64 flex-shrink-0">
            <BlockLibrary />
          </div>
          
          <WeekGrid
            plan={plan}
            currentWeek={currentWeek}
            templates={state.templates}
            onBlockClick={(block) => setSelectedBlockId(block.id)}
            onBlockResize={handleBlockResize}
            selectedBlockId={selectedBlockId}
          />
          
          {selectedBlock ? (
            <BlockEditPanel
              block={selectedBlock}
              template={selectedTemplate}
              plan={plan}
              onUpdate={handleBlockUpdate}
              onDelete={handleBlockDelete}
              onDuplicate={handleBlockDuplicate}
              onClose={() => setSelectedBlockId(null)}
              onCreateRecurrence={handleCreateRecurrence}
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
              <p className="text-xs text-gray-500">{(draggedItem.data as BlockTemplate).defaultDurationMinutes}m</p>
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

      <PlanEditor plan={plan} open={showSettings} onClose={() => setShowSettings(false)} onToggleDiagnostics={() => setShowDiagnostics(!showDiagnostics)} showDiagnostics={showDiagnostics} />
      <ExportImportPanel plan={plan} open={showExport} onClose={() => setShowExport(false)} />
      
      <ConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetWeek}
        title="Reset Week"
        message={`Are you sure you want to clear all blocks from Week ${currentWeek}? This action cannot be undone.`}
        confirmText="Reset"
      />
    </DndContext>
  );
}
