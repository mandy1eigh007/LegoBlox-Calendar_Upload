import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, PlacedBlock, Day, DAYS, ApplyScope, RecurrenceSeries } from '@/state/types';
import { BlockLibrary } from './BlockLibrary';
import { WeekGrid } from './WeekGrid';
import { BlockEditPanel } from './BlockEditPanel';
import { GoldenRuleTotals } from './GoldenRuleTotals';
import { PlanEditor } from './PlanEditor';
import { ExportImportPanel } from './ExportImportPanel';
import { PrintView } from './PrintView';
import { CompareMode } from './CompareMode';
import { PartnersPanel } from './PartnersPanel';
import { ConfirmModal } from './Modal';
import { ScheduleSuggestionPanel } from './ScheduleSuggestionPanel';
import { SuggestedBlock } from '@/lib/predictiveScheduler';
import { UnassignedReviewPanel } from './UnassignedReviewPanel';
import { TemplateReassignDialog } from './TemplateReassignDialog';
import { generatePublicId, getStudentUrl } from '@/lib/publish';
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
  const [showCompare, setShowCompare] = useState(false);
  const [showPartners, setShowPartners] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'template' | 'placed-block'; data: BlockTemplate | PlacedBlock } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [reassignBlock, setReassignBlock] = useState<PlacedBlock | null>(null);
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

  const handleCreateRecurrence = (blocks: PlacedBlock[], series?: RecurrenceSeries) => {
    if (selectedBlockId) {
      dispatch({ type: 'DELETE_BLOCK', payload: { planId: plan.id, blockId: selectedBlockId } });
    }
    
    if (series) {
      dispatch({ type: 'ADD_RECURRENCE_SERIES', payload: { planId: plan.id, series } });
    }
    
    for (const block of blocks) {
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
    }
    
    setSelectedBlockId(null);
  };

  const handleUpdateRecurrence = (oldSeriesId: string, blocks: PlacedBlock[], newSeries: RecurrenceSeries) => {
    dispatch({ type: 'DELETE_RECURRENCE_SERIES', payload: { planId: plan.id, seriesId: oldSeriesId } });
    
    dispatch({ type: 'ADD_RECURRENCE_SERIES', payload: { planId: plan.id, series: newSeries } });
    
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

  const handleAcceptSuggestions = (suggestions: SuggestedBlock[]) => {
    for (const suggestion of suggestions) {
      const { isNew, bucketLabel, ...block } = suggestion;
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
    }
  };

  const handlePublish = () => {
    const publicId = plan.publicId || generatePublicId();
    const timestamp = new Date().toISOString();
    dispatch({ type: 'PUBLISH_PLAN', payload: { planId: plan.id, publicId, timestamp } });
  };

  const handleUnpublish = () => {
    const timestamp = new Date().toISOString();
    dispatch({ type: 'UNPUBLISH_PLAN', payload: { planId: plan.id, timestamp } });
  };

  const handleCopyLink = async () => {
    if (plan.publicId) {
      try {
        await navigator.clipboard.writeText(getStudentUrl(plan.publicId));
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch {
        alert(`Copy this link: ${getStudentUrl(plan.publicId)}`);
      }
    }
  };

  const handleAssignBlock = (blockId: string, templateId: string) => {
    const timestamp = new Date().toISOString();
    dispatch({ type: 'ASSIGN_BLOCK_TEMPLATE', payload: { planId: plan.id, blockId, templateId, timestamp } });
  };

  const handleAssignMultiple = (blockIds: string[], templateId: string) => {
    const timestamp = new Date().toISOString();
    dispatch({ type: 'ASSIGN_MULTIPLE_BLOCKS_TEMPLATE', payload: { planId: plan.id, blockIds, templateId, timestamp } });
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

  if (showCompare) {
    return (
      <CompareMode
        currentPlanId={plan.id}
        currentWeek={currentWeek}
        onClose={() => setShowCompare(false)}
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
              Export / Import
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="print-view-button"
            >
              Print View
            </button>
            <button
              onClick={() => setShowCompare(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="compare-calendars-button"
            >
              Compare
            </button>
            <button
              onClick={() => setShowPartners(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="partners-button"
            >
              Partners
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              data-testid="edit-settings-button"
            >
              Edit Settings
            </button>
            {plan.settings.schedulerMode === 'predictive' && (
              <button
                onClick={() => setShowSuggestions(true)}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                data-testid="suggest-schedule-button"
              >
                Suggest Schedule
              </button>
            )}
            
            {plan.isPublished ? (
              <button
                onClick={handleUnpublish}
                className="px-3 py-1 text-sm bg-amber-100 text-amber-800 border border-amber-300 rounded hover:bg-amber-200"
                data-testid="unpublish-button"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={handlePublish}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                data-testid="publish-button"
              >
                Publish for Students
              </button>
            )}
          </div>
        </header>
        
        {plan.isPublished && plan.publicId && (
          <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-sm" data-testid="published-banner">
            <div className="flex items-center gap-3">
              <span className="text-green-700 font-medium">Published</span>
              <span className="text-green-600 text-xs truncate flex-1">{getStudentUrl(plan.publicId)}</span>
              <button
                onClick={handleCopyLink}
                className="px-2 py-1 text-xs border border-green-300 rounded hover:bg-green-100"
                data-testid="copy-link-button"
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-xs text-green-600 mt-1">
              Link works on this device. For other devices, export a JSON backup from Export/Import panel.
            </p>
          </div>
        )}
        
        {plan.settings.schedulerMode === 'predictive' && (
          <div className="bg-purple-50 border-b border-purple-200 px-4 py-2 text-sm text-purple-700 flex items-center gap-2" data-testid="predictive-mode-banner">
            <span className="font-medium">Predictive Mode:</span>
            <span>Click "Suggest Schedule" to auto-generate blocks based on Golden Rule budgets.</span>
          </div>
        )}

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
            onBlockDoubleClick={(block) => setReassignBlock(block)}
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
              onUpdateRecurrence={handleUpdateRecurrence}
            />
          ) : (
            <div className="w-72 flex-shrink-0">
              <GoldenRuleTotals 
                plan={plan} 
                templates={state.templates} 
                onShowUnassigned={() => setShowUnassigned(true)}
              />
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
      
      {showPartners && (
        <PartnersPanel
          onClose={() => setShowPartners(false)}
          onCreateTemplate={(template) => {
            dispatch({ type: 'ADD_TEMPLATE', payload: template });
          }}
        />
      )}
      
      {showSuggestions && (
        <ScheduleSuggestionPanel
          plan={plan}
          templates={state.templates}
          currentWeek={currentWeek}
          open={showSuggestions}
          onClose={() => setShowSuggestions(false)}
          onAccept={handleAcceptSuggestions}
        />
      )}
      
      <UnassignedReviewPanel
        plan={plan}
        templates={state.templates}
        open={showUnassigned}
        onClose={() => setShowUnassigned(false)}
        onAssignBlock={handleAssignBlock}
        onAssignMultiple={handleAssignMultiple}
      />
      
      {reassignBlock && (
        <TemplateReassignDialog
          open={!!reassignBlock}
          onClose={() => setReassignBlock(null)}
          block={reassignBlock}
          templates={state.templates}
          allBlocks={plan.blocks}
          onAssign={handleAssignBlock}
          onAssignMultiple={handleAssignMultiple}
        />
      )}
      
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
