import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, PlacedBlock, Day, DAYS, ApplyScope, RecurrenceSeries, HardDate } from '@/state/types';
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
import { ComparePlans } from './ComparePlans';
import { CreateEventDialog } from './CreateEventDialog';
import { generatePublicId, getStudentUrl } from '@/lib/publish';
import { findTimeConflicts, findNextAvailableSlot, wouldFitInDay } from '@/lib/collision';
import { findAlternativeResource } from '@/lib/calendarCompare';
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
  const [conflictSuggestion, setConflictSuggestion] = useState<{ blockId: string; alternateResource: string } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'template' | 'placed-block'; data: BlockTemplate | PlacedBlock } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [reassignBlock, setReassignBlock] = useState<PlacedBlock | null>(null);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
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
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setConflictSuggestion(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (!showDiagnostics) {
      setHoverMinutes(null);
    }
  }, [showDiagnostics]);

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
    if (!showDiagnostics || !gridRef.current) return;
    const minutes = calculateDropMinutes(e.clientY, gridRef.current);
    setHoverMinutes(prev => (prev === minutes ? prev : minutes));
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
    // Use the original activator event Y to avoid large drag "jumps"
    const activatorClientY = (event.activatorEvent as PointerEvent)?.clientY;
    const finalY = typeof activatorClientY === 'number' ? activatorClientY : 0;
    const dropMinutes = calculateDropMinutes(finalY, gridElement);
    
    if (activeData?.type === 'template') {
      const template = activeData.template as BlockTemplate;
      placeNewBlock(template, day, dropMinutes);
    } else if (activeData?.type === 'placed-block') {
      const block = activeData.block as PlacedBlock;
      if (block.isLocked) {
        setErrorMessage('This block is locked. Unlock it in the edit panel to move it.');
        return;
      }
      moveBlock(block, day, dropMinutes);
    }
  };

  const placeNewBlock = (template: BlockTemplate, day: Day, startMinutes: number) => {
    const duration = template.defaultDurationMinutes;
    const defaultResource = template.defaultResource || template.defaultLocation || undefined;
    const shouldAutoPlace = autoPlace && !settings.allowOverlaps;
    const autoPlacedStart = shouldAutoPlace
      ? findNextAvailableSlot(
          plan.blocks,
          currentWeek,
          day,
          startMinutes,
          duration,
          settings.dayStartMinutes,
          settings.dayEndMinutes,
          settings.slotMinutes,
          undefined,
          defaultResource
        )
      : null;
    const finalStartMinutes = autoPlacedStart ?? startMinutes;

    if (shouldAutoPlace && autoPlacedStart === null) {
      setErrorMessage('No open slots available on this day.');
      return;
    }
    
    if (!wouldFitInDay(finalStartMinutes, duration, settings.dayEndMinutes)) {
      setErrorMessage(`Block would extend beyond ${minutesToTimeDisplay(settings.dayEndMinutes)}.`);
      return;
    }
    
    const conflicts = findTimeConflicts(
      plan.blocks,
      currentWeek,
      day,
      finalStartMinutes,
      duration,
      undefined,
      defaultResource
    );
    
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
      startMinutes: finalStartMinutes,
      durationMinutes: duration,
      titleOverride: '',
      location: template.defaultLocation,
      notes: template.defaultNotes,
      countsTowardGoldenRule: template.countsTowardGoldenRule,
      goldenRuleBucketId: template.goldenRuleBucketId,
      recurrenceSeriesId: null,
      isRecurrenceException: false,
      resource: template.defaultResource || undefined,
      isLocked: false,
    };
    
    dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
  };

  const moveBlock = (block: PlacedBlock, newDay: Day, newStartMinutes: number) => {
    if (block.isLocked) {
      setErrorMessage('This block is locked. Unlock it in the edit panel to move it.');
      return;
    }
    const duration = block.durationMinutes;
    
    if (!wouldFitInDay(newStartMinutes, duration, settings.dayEndMinutes)) {
      setErrorMessage(`Block would extend beyond ${minutesToTimeDisplay(settings.dayEndMinutes)}.`);
      return;
    }
    
    const conflicts = findTimeConflicts(plan.blocks, currentWeek, newDay, newStartMinutes, duration, block.id, block.resource || block.location || undefined);
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      const conflictTitle = state.templates.find(t => t.id === conflicts[0].templateId)?.title || 'Unknown';
      setErrorMessage(`Cannot move. Conflicts with: ${conflictTitle}`);
      
      // Check for alternate resource suggestion
      const tempBlock: PlacedBlock = { ...block, week: currentWeek, day: newDay, startMinutes: newStartMinutes };
      const availableResources = plan.settings.resources && plan.settings.resources.length > 0 
        ? plan.settings.resources 
        : ['Room A', 'Room B', 'Room C', 'Lab 1', 'Lab 2'];
      const alternate = findAlternativeResource(tempBlock, plan, availableResources);
      if (alternate) {
        setConflictSuggestion({ blockId: block.id, alternateResource: alternate });
      } else {
        setConflictSuggestion(null);
      }
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
    if (block.isLocked) {
      setErrorMessage('This block is locked. Unlock it in the edit panel to resize it.');
      return;
    }
    
    if (newDuration % 15 !== 0) return;
    
    if (!wouldFitInDay(block.startMinutes, newDuration, settings.dayEndMinutes)) {
      return;
    }
    
    const conflicts = findTimeConflicts(
      plan.blocks, block.week, block.day,
      block.startMinutes, newDuration, block.id, block.resource || block.location || undefined
    );
    
    if (conflicts.length > 0 && !settings.allowOverlaps) {
      return;
    }
    
    const updatedBlock: PlacedBlock = { ...block, durationMinutes: newDuration };
    dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updatedBlock } });
  };

  const handleBlockUpdate = (updatedBlock: PlacedBlock, scope?: ApplyScope) => {
    const existingBlock = plan.blocks.find(b => b.id === updatedBlock.id);
    if (existingBlock?.isLocked) {
      const placementChanged = existingBlock.week !== updatedBlock.week ||
        existingBlock.day !== updatedBlock.day ||
        existingBlock.startMinutes !== updatedBlock.startMinutes ||
        existingBlock.durationMinutes !== updatedBlock.durationMinutes;
      if (placementChanged) {
        setErrorMessage('This block is locked. Unlock it to change time or duration.');
        return;
      }
    }
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
      updatedBlock.startMinutes, updatedBlock.durationMinutes, updatedBlock.id, updatedBlock.resource || updatedBlock.location || undefined
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
    (async () => {
      const publicId = plan.publicId || generatePublicId();
      const timestamp = new Date().toISOString();
      try {
        const res = await fetch(`/api/plans/${plan.id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: { ...plan, publicId, isPublished: true, publishedAt: timestamp },
            templates: state.templates,
          }),
        });
        if (!res.ok) throw new Error('publish failed');
        const json = await res.json();
        const slug = json.slug || publicId;
        dispatch({ type: 'PUBLISH_PLAN', payload: { planId: plan.id, publicId: slug, timestamp } });
      } catch (e) {
        setErrorMessage('Failed to publish plan to server.');
      }
    })();
  };

  const handleUnpublish = () => {
    const timestamp = new Date().toISOString();
    (async () => {
      try {
        const res = await fetch(`/api/plans/${plan.id}/unpublish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: plan.publicId }),
        });
        if (!res.ok) throw new Error('unpublish failed');
        dispatch({ type: 'UNPUBLISH_PLAN', payload: { planId: plan.id, timestamp } });
      } catch (e) {
        setErrorMessage('Failed to unpublish plan from server.');
      }
    })();
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

  const handleAssignBlock = (blockId: string, templateId: string | null) => {
    const timestamp = new Date().toISOString();
    dispatch({ type: 'ASSIGN_BLOCK_TEMPLATE', payload: { planId: plan.id, blockId, templateId, timestamp } });
  };
  
  // Assign with optional countsTowardGoldenRule override (single block)
  const handleAssignBlockWithFlags = (blockId: string, templateId: string | null, countsOverride?: boolean) => {
    const timestamp = new Date().toISOString();
    if (templateId === null) {
      const block = plan.blocks.find(b => b.id === blockId);
      if (!block) return;
      const updated = {
        ...block,
        templateId: null,
        countsTowardGoldenRule: false,
        goldenRuleBucketId: null,
      };
      dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updated } });
      return;
    }
    const template = state.templates.find(t => t.id === templateId);
    if (typeof countsOverride === 'boolean') {
      const block = plan.blocks.find(b => b.id === blockId);
      if (!block) return;
      const updated = {
        ...block,
        templateId,
        countsTowardGoldenRule: countsOverride,
        goldenRuleBucketId: countsOverride ? (template?.goldenRuleBucketId ?? null) : null,
      };
      dispatch({ type: 'UPDATE_BLOCK', payload: { planId: plan.id, block: updated } });
      return;
    }

    dispatch({ type: 'ASSIGN_BLOCK_TEMPLATE', payload: { planId: plan.id, blockId, templateId, timestamp } });
  };
  const handleAssignMultiple = (blockIds: string[], templateId: string | null) => {
    const timestamp = new Date().toISOString();
    dispatch({ type: 'ASSIGN_MULTIPLE_BLOCKS_TEMPLATE', payload: { planId: plan.id, blockIds, templateId, timestamp } });
  };

  const selectedBlock = selectedBlockId ? plan.blocks.find(b => b.id === selectedBlockId) : null;

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
      <div className="h-screen flex flex-col">
        <header className="glass-panel border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="back-to-plans"
            >
              Back
            </button>
            <h1 className="font-semibold text-lg gradient-text">{plan.settings.name}</h1>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Week:</span>
              <select
                value={currentWeek}
                onChange={e => setCurrentWeek(parseInt(e.target.value))}
                className="px-3 py-1 bg-input border border-border rounded-lg text-sm text-foreground"
                data-testid="week-selector"
              >
                {Array.from({ length: settings.weeks }, (_, i) => i + 1).map(week => (
                  <option key={week} value={week}>Week {week}</option>
                ))}
              </select>
            </div>
            
            <label className="flex items-center gap-1 text-sm text-foreground">
              <input
                type="checkbox"
                checked={autoPlace}
                onChange={e => setAutoPlace(e.target.checked)}
                className="accent-primary"
                data-testid="auto-place-toggle"
              />
              Auto-place
            </label>
            
            <button
              onClick={handleCopyWeek}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="copy-week-button"
            >
              Copy to Next Week
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
              data-testid="reset-week-button"
            >
              Reset Week
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="export-button"
            >
              Export / Import
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="print-view-button"
            >
              Print View
            </button>
            <button
              onClick={() => setShowCompare(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="compare-calendars-button"
            >
              Compare
            </button>
            <button
              onClick={() => setShowPartners(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="partners-button"
            >
              Partners
            </button>
            <button
              onClick={() => setShowCreateEvent(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="create-event-button"
            >
              Create Event
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-1 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="edit-settings-button"
            >
              Edit Settings
            </button>
            {plan.settings.schedulerMode === 'predictive' && (
              <button
                onClick={() => setShowSuggestions(true)}
                className="px-3 py-1 text-sm bg-accent text-accent-foreground rounded-lg hover:opacity-90 glow-accent transition-all"
                data-testid="suggest-schedule-button"
              >
                Suggest Schedule
              </button>
            )}
            
            {plan.isPublished ? (
              <button
                onClick={handleUnpublish}
                className="px-3 py-1 text-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all"
                data-testid="unpublish-button"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={handlePublish}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                data-testid="publish-button"
              >
                Publish for Students
              </button>
            )}
          </div>
        </header>
        
        {plan.isPublished && plan.publicId && (
          <div className="bg-green-900/30 border-b border-green-500/30 px-4 py-2 text-sm" data-testid="published-banner">
            <div className="flex items-center gap-3">
              <span className="text-green-300 font-medium">Published</span>
              <span className="text-green-400 text-xs truncate flex-1">{getStudentUrl(plan.publicId)}</span>
              <button
                onClick={handleCopyLink}
                className="px-2 py-1 text-xs border border-green-500/30 rounded-lg text-green-300 hover:bg-green-500/10 transition-all"
                data-testid="copy-link-button"
              >
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="text-xs text-green-400 mt-1">
              Share this link with students. For offline backups, export JSON from Export/Import.
            </p>
          </div>
        )}
        
        {plan.settings.schedulerMode === 'predictive' && (
          <div className="bg-accent/10 border-b border-accent/30 px-4 py-2 text-sm text-accent flex items-center gap-2" data-testid="predictive-mode-banner">
            <span className="font-medium">Predictive Mode:</span>
            <span>Click "Suggest Schedule" to auto-generate blocks based on Golden Rule budgets.</span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-900/30 border-b border-red-500/30 px-4 py-2 text-sm text-red-300 flex items-center justify-between gap-2" data-testid="error-message">
            <span>{errorMessage}</span>
            {conflictSuggestion && (
              <button
                onClick={() => {
                  const block = plan.blocks.find(b => b.id === conflictSuggestion.blockId);
                  if (block) {
                    dispatch({
                      type: 'UPDATE_BLOCK',
                      payload: {
                        planId: plan.id,
                        block: { ...block, resource: conflictSuggestion.alternateResource }
                      }
                    });
                    setErrorMessage(null);
                    setConflictSuggestion(null);
                  }
                }}
                className="px-3 py-1 text-xs bg-accent text-accent-foreground rounded-lg hover:opacity-90 whitespace-nowrap transition-all"
                data-testid="apply-resource-suggestion"
              >
                Use {conflictSuggestion.alternateResource}
              </button>
            )}
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
            <BlockLibrary
              externalEditTemplateId={editTemplateId}
              onExternalEditHandled={() => setEditTemplateId(null)}
            />
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

          <div className="absolute top-4 right-4 z-50 flex gap-2">
            <button
              className="px-3 py-1 bg-white border rounded"
              onClick={() => setShowCompare(true)}
              data-testid="open-compare"
            >
              Compare Plans
            </button>
          </div>
          
          {selectedBlock ? (
            <BlockEditPanel
              block={selectedBlock}
              templates={state.templates}
              plan={plan}
              onUpdate={handleBlockUpdate}
              onDelete={handleBlockDelete}
              onDuplicate={handleBlockDuplicate}
              onClose={() => setSelectedBlockId(null)}
              onCreateRecurrence={handleCreateRecurrence}
              onUpdateRecurrence={handleUpdateRecurrence}
              onEditTemplate={(templateId) => setEditTemplateId(templateId)}
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

      <CreateEventDialog
        open={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        templates={state.templates}
        onCreate={(block: any, newTemplate?: any) => {
          // add optional template first
          if (newTemplate) {
            dispatch({ type: 'ADD_TEMPLATE', payload: newTemplate });
          }
          // ensure block id and plan
          const b = { ...block, id: block.id || uuidv4() };
          dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block: b } });
        }}
      />
      
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
          onUpdateHardDates={(hardDates: HardDate[]) => {
            dispatch({
              type: 'UPDATE_PLAN',
              payload: {
                ...plan,
                settings: { ...plan.settings, hardDates }
              }
            });
          }}
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
          onAssign={handleAssignBlockWithFlags}
          onAssignMultiple={handleAssignMultiple}
        />
      )}

      {showCompare && (
        <ComparePlans
          open={showCompare}
          onClose={() => setShowCompare(false)}
          plans={state.plans}
          onOpenConflictInBuilder={(planId, blockId) => {
            // navigate to plan and open the block in builder
            if (planId !== plan.id) {
              navigate(`/plan/${planId}`);
            }
            // find the plan and block and set selected
            const p = state.plans.find(pl => pl.id === planId);
            if (!p) return;
            const b = p.blocks.find(bl => bl.id === blockId);
            if (!b) return;
            setSelectedBlockId(b.id);
            setShowCompare(false);
          }}
          onResolveConflict={(planId, blockId, newResource) => {
            const p = state.plans.find(pl => pl.id === planId);
            if (!p) return;
            const b = p.blocks.find(bl => bl.id === blockId);
            if (!b) return;
            const updated = { ...b, resource: newResource };
            dispatch({ type: 'UPDATE_BLOCK', payload: { planId: p.id, block: updated } });
            setShowCompare(false);
          }}
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
