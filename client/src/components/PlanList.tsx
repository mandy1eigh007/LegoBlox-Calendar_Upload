import { useState, useRef, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES, AppState, PlacedBlock, Day, DAYS, GOLDEN_RULE_BUCKETS, SchedulerMode } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { createDefaultPlanSettings } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { validateAppState } from '@/state/validators';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { parseICSWithDateRange, convertICSEventsToBlocks, ICSEventWithDate } from '@/lib/csv';
import { resolveTemplateForImportedTitle, TemplateCandidate, getBucketLabel } from '@/lib/templateMatcher';
import { Loader2, AlertTriangle } from 'lucide-react';

type DateRangeMode = 'all' | 'range' | 'week';
type ImportTarget = 'new' | 'existing';

export function PlanList() {
  const { state, dispatch } = useStore();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanSettings>(createDefaultPlanSettings());
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [ocrProcessing, setOCRProcessing] = useState(false);
  const [ocrProgress, setOCRProgress] = useState(0);
  const [ocrEvents, setOCREvents] = useState<OCREvent[]>([]);
  const [ocrPlanName, setOCRPlanName] = useState('');
  const [ocrRawText, setOCRRawText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEvents, setManualEvents] = useState<Array<{id: string; title: string; day: Day; startMinutes: number; durationMinutes: number}>>([]);
  const [icsImportPlanName, setIcsImportPlanName] = useState('');
  const [pendingICSEvents, setPendingICSEvents] = useState<ICSEventWithDate[]>([]);
  const [icsMinDate, setIcsMinDate] = useState<Date | null>(null);
  const [icsMaxDate, setIcsMaxDate] = useState<Date | null>(null);
  const [icsMinDateStr, setIcsMinDateStr] = useState<string>('');
  const [icsMaxDateStr, setIcsMaxDateStr] = useState<string>('');
  const [icsStartDate, setIcsStartDate] = useState<string>('');
  const [icsEndDate, setIcsEndDate] = useState<string>('');
  const [icsDetectedTimezone, setIcsDetectedTimezone] = useState<string | null>(null);
  const [icsDateRangeMode, setIcsDateRangeMode] = useState<DateRangeMode>('all');
  const [icsIncludeOutsideHours, setIcsIncludeOutsideHours] = useState(false);
  const [icsImportTarget, setIcsImportTarget] = useState<ImportTarget>('new');
  const [icsTargetPlanId, setIcsTargetPlanId] = useState<string>('');
  const [icsPlanStartDate, setIcsPlanStartDate] = useState<string>('');
  const [icsSelectedEvents, setIcsSelectedEvents] = useState<Set<string>>(new Set());
  const [icsBulkResource, setIcsBulkResource] = useState<string>('');
  const [icsBulkBucketId, setIcsBulkBucketId] = useState<string>('');
  const [showPasteICS, setShowPasteICS] = useState(false);
  const [pasteICSText, setPasteICSText] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [icsTemplateAssignments, setIcsTemplateAssignments] = useState<Record<string, string | null>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    
    const plan: Plan = {
      id: uuidv4(),
      settings: { ...formData },
      blocks: [],
      recurrenceSeries: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setShowCreate(false);
    setFormData(createDefaultPlanSettings());
    navigate(`/plan/${plan.id}`);
  };

  const handleDelete = () => {
    if (deleteId) {
      dispatch({ type: 'DELETE_PLAN', payload: deleteId });
      setDeleteId(null);
    }
  };

  const handleJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        const validation = validateAppState(parsed);
        if (!validation.valid) {
          setImportError(validation.error || 'Invalid file format');
          return;
        }

        dispatch({
          type: 'IMPORT_STATE',
          payload: { state: parsed as AppState, mode: 'merge' },
        });
        
        setImportError(null);
      } catch (err) {
        setImportError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const handleOCRFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOCRProcessing(true);
    setOCRProgress(0);
    setImportError(null);

    try {
      const { events, rawText } = await processImageWithOCR(file, setOCRProgress);
      setOCREvents(events);
      setOCRRawText(rawText);
      setOCRPlanName(`Imported from ${file.name.replace(/\.[^/.]+$/, '')}`);
      
      if (events.length === 0) {
        setImportError('No schedule events detected. Screenshot import works best with clear text. For Google Calendar, try exporting as ICS instead (Calendar Settings → Export).');
      }
    } catch (err) {
      setImportError('Failed to process image. Please try again.');
    } finally {
      setOCRProcessing(false);
    }

    if (ocrInputRef.current) {
      ocrInputRef.current.value = '';
    }
  };

  const handleCreatePlanFromOCR = () => {
    if (!ocrPlanName.trim() || ocrEvents.length === 0) return;

    const blocks: PlacedBlock[] = [];
    for (const event of ocrEvents) {
      const hasValidTime = event.startMinutes !== null && event.endMinutes !== null && event.day;
      const startMinutes = hasValidTime 
        ? Math.max(390, Math.min(event.startMinutes!, 915))
        : 390;
      let durationMinutes = hasValidTime 
        ? (event.endMinutes! - event.startMinutes!)
        : 30;
      durationMinutes = Math.max(15, Math.ceil(durationMinutes / 15) * 15);
      
      if (startMinutes + durationMinutes > 930) {
        durationMinutes = 930 - startMinutes;
      }
      
      const matchResult = resolveTemplateForImportedTitle(event.title, state.templates);
      const matchedTemplate = matchResult.templateId ? state.templates.find(t => t.id === matchResult.templateId) : null;
      
      blocks.push({
        id: uuidv4(),
        templateId: matchResult.templateId,
        week: 1,
        day: event.day || 'Monday',
        startMinutes,
        durationMinutes,
        titleOverride: event.title,
        location: '',
        notes: hasValidTime ? `Imported via OCR: ${event.rawText}` : `Draft block from OCR - adjust time as needed: ${event.rawText}`,
        countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
        goldenRuleBucketId: matchedTemplate ? matchedTemplate.goldenRuleBucketId : null,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
      });
    }

    const plan: Plan = {
      id: uuidv4(),
      settings: { ...createDefaultPlanSettings(), name: ocrPlanName },
      blocks,
      recurrenceSeries: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setOCREvents([]);
    setOCRPlanName('');
    navigate(`/plan/${plan.id}`);
  };

  const handleICSImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { events, minDate, maxDate, minDateStr, maxDateStr, detectedTimezone } = parseICSWithDateRange(content);
        
        if (events.length === 0) {
          setImportError('No events found in ICS file.');
          return;
        }

        setPendingICSEvents(events);
        setIcsMinDate(minDate);
        setIcsMaxDate(maxDate);
        setIcsMinDateStr(minDateStr);
        setIcsMaxDateStr(maxDateStr);
        setIcsStartDate(minDateStr);
        setIcsEndDate(maxDateStr);
        setIcsDetectedTimezone(detectedTimezone);
        setIcsPlanStartDate(minDateStr);
        setIcsImportPlanName(`Imported from ${file.name.replace(/\.[^/.]+$/, '')}`);
        setIcsDateRangeMode('all');
        setIcsIncludeOutsideHours(false);
        setIcsSelectedEvents(new Set());
        setImportSuccess(null);
        setImportError(null);
      } catch (err) {
        setImportError('Failed to parse ICS file');
      }
    };
    reader.readAsText(file);
  };

  const handleICSFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleICSImport(file);
    if (icsInputRef.current) {
      icsInputRef.current.value = '';
    }
  };

  const handleCreatePlanFromICS = () => {
    if (!icsImportPlanName.trim() || filteredICSEvents.length === 0) return;
    
    const startDate = icsDateRangeMode === 'all' && icsMinDate ? icsMinDate : new Date(icsStartDate);
    const endDate = icsDateRangeMode === 'all' && icsMaxDate ? icsMaxDate : new Date(icsEndDate);
    
    const { blocks, included } = convertICSEventsToBlocks(
      filteredICSEvents,
      state.templates,
      startDate,
      endDate,
      icsIncludeOutsideHours
    );
    
    if (blocks.length === 0) {
      setImportError('No valid events to import. Check your filters and try again.');
      return;
    }
    
    const blocksWithAssignments = blocks.map((block, idx) => {
      const event = filteredICSEvents[idx];
      if (!event) return block;
      
      const manualAssignment = icsTemplateAssignments[event.uid];
      const suggestedTemplate = icsTemplateSuggestions[event.uid]?.match.templateId;
      const templateId = manualAssignment !== undefined ? manualAssignment : (suggestedTemplate || block.templateId);
      
      if (templateId && templateId !== block.templateId) {
        const template = state.templates.find(t => t.id === templateId);
        return {
          ...block,
          templateId,
          countsTowardGoldenRule: template?.countsTowardGoldenRule ?? false,
          goldenRuleBucketId: template?.goldenRuleBucketId ?? null,
        };
      }
      return block;
    });
    
    const plan: Plan = {
      id: uuidv4(),
      settings: { ...createDefaultPlanSettings(), name: icsImportPlanName },
      blocks: blocksWithAssignments,
      recurrenceSeries: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    clearICSImport();
    setImportSuccess(`Created plan with ${included} events!`);
    navigate(`/plan/${plan.id}`);
  };
  
  const clearICSImport = () => {
    setPendingICSEvents([]);
    setIcsImportPlanName('');
    setIcsStartDate('');
    setIcsEndDate('');
    setIcsMinDate(null);
    setIcsMaxDate(null);
    setIcsMinDateStr('');
    setIcsMaxDateStr('');
    setIcsDetectedTimezone(null);
    setIcsDateRangeMode('all');
    setIcsIncludeOutsideHours(false);
    setIcsImportTarget('new');
    setIcsTargetPlanId('');
    setIcsPlanStartDate('');
    setIcsSelectedEvents(new Set());
    setIcsBulkResource('');
    setIcsBulkBucketId('');
    setIcsTemplateAssignments({});
    setExpandedEventId(null);
  };
  
  const handlePasteICSParse = () => {
    if (!pasteICSText.trim()) return;
    
    try {
      const { events, minDate, maxDate, minDateStr, maxDateStr, detectedTimezone } = parseICSWithDateRange(pasteICSText);
      
      if (events.length === 0) {
        setImportError('No events found in pasted ICS content.');
        return;
      }

      setPendingICSEvents(events);
      setIcsMinDate(minDate);
      setIcsMaxDate(maxDate);
      setIcsMinDateStr(minDateStr);
      setIcsMaxDateStr(maxDateStr);
      setIcsStartDate(minDateStr);
      setIcsEndDate(maxDateStr);
      setIcsDetectedTimezone(detectedTimezone);
      setIcsPlanStartDate(minDateStr);
      setIcsImportPlanName('Pasted Calendar');
      setIcsDateRangeMode('all');
      setIcsIncludeOutsideHours(false);
      setIcsSelectedEvents(new Set());
      setShowPasteICS(false);
      setPasteICSText('');
      setImportError(null);
    } catch (err) {
      setImportError('Failed to parse pasted ICS content. Make sure it starts with BEGIN:VCALENDAR');
    }
  };
  
  const filteredICSEvents = useMemo(() => {
    return pendingICSEvents.filter(e => {
      if (icsDateRangeMode === 'all') {
        // No date filtering
      } else if (icsDateRangeMode === 'range' || icsDateRangeMode === 'week') {
        if (icsStartDate && icsEndDate) {
          if (e.localDateStr < icsStartDate || e.localDateStr > icsEndDate) return false;
        }
      }
      
      if (e.isWeekend) return false;
      
      if (!icsIncludeOutsideHours && e.isOutsideScheduleHours) return false;
      
      return true;
    });
  }, [pendingICSEvents, icsDateRangeMode, icsStartDate, icsEndDate, icsIncludeOutsideHours]);
  
  const roundedEventsCount = filteredICSEvents.filter(e => e.wasRounded).length;
  const outsideHoursCount = pendingICSEvents.filter(e => e.isOutsideScheduleHours && !e.isWeekend).length;
  
  const icsTemplateSuggestions = useMemo(() => {
    const suggestions: Record<string, { 
      match: ReturnType<typeof resolveTemplateForImportedTitle>;
      candidates: TemplateCandidate[];
    }> = {};
    
    for (const event of filteredICSEvents) {
      const result = resolveTemplateForImportedTitle(event.summary, state.templates);
      suggestions[event.uid] = {
        match: result,
        candidates: result.candidates,
      };
    }
    return suggestions;
  }, [filteredICSEvents, state.templates]);
  
  const assignTemplateToEvent = (eventUid: string, templateId: string | null) => {
    setIcsTemplateAssignments(prev => ({ ...prev, [eventUid]: templateId }));
    setExpandedEventId(null);
  };
  
  const getEventAssignedTemplate = (eventUid: string) => {
    if (icsTemplateAssignments[eventUid] !== undefined) {
      return icsTemplateAssignments[eventUid];
    }
    const suggestion = icsTemplateSuggestions[eventUid];
    return suggestion?.match.templateId || null;
  };
  
  const handleBulkApply = () => {
    if (icsSelectedEvents.size === 0 || (icsBulkResource === '' && icsBulkBucketId === '')) return;
    
    const updatedEvents = pendingICSEvents.map(event => {
      if (!icsSelectedEvents.has(event.uid)) return event;
      return {
        ...event,
        resource: icsBulkResource || event.resource,
        goldenRuleBucketId: icsBulkBucketId || event.goldenRuleBucketId,
      };
    });
    
    setPendingICSEvents(updatedEvents);
    setIcsBulkResource('');
    setIcsBulkBucketId('');
  };
  
  const toggleEventSelection = (uid: string) => {
    const newSet = new Set(icsSelectedEvents);
    if (newSet.has(uid)) {
      newSet.delete(uid);
    } else {
      newSet.add(uid);
    }
    setIcsSelectedEvents(newSet);
  };
  
  const selectAllEvents = () => {
    setIcsSelectedEvents(new Set(filteredICSEvents.map(e => e.uid)));
  };
  
  const deselectAllEvents = () => {
    setIcsSelectedEvents(new Set());
  };
  
  const handleDateRangeModeChange = (mode: DateRangeMode) => {
    setIcsDateRangeMode(mode);
    if (mode === 'all') {
      setIcsStartDate(icsMinDateStr);
      setIcsEndDate(icsMaxDateStr);
    } else if (mode === 'week' && icsMinDate) {
      // Select just the first week
      const end = new Date(icsMinDate);
      end.setDate(end.getDate() + 6);
      setIcsStartDate(icsMinDateStr);
      setIcsEndDate(formatLocalDateForInput(end));
    }
  };
  
  const formatLocalDateForInput = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    if (fileName.endsWith('.ics') || fileName.endsWith('.ical') || fileType === 'text/calendar') {
      handleICSImport(file);
    } else if (fileName.endsWith('.json') || fileType === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);
          const validation = validateAppState(parsed);
          if (!validation.valid) {
            setImportError(validation.error || 'Invalid JSON file format');
            return;
          }
          dispatch({ type: 'IMPORT_STATE', payload: { state: parsed as AppState, mode: 'merge' } });
          setImportSuccess('Backup imported successfully!');
          setImportError(null);
        } catch (err) {
          setImportError('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    } else if (fileType.startsWith('image/')) {
      handleOCRFileSelect({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    } else {
      setImportError(`Unsupported file type. Drag an ICS, JSON, or image file.`);
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg p-8 shadow-lg text-center">
            <p className="text-lg font-medium">Drop your file here</p>
            <p className="text-sm text-gray-500">ICS, JSON, or image files</p>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cohort Schedule Builder</h1>
          <p className="text-gray-600 mt-1">Plan and manage pre-apprenticeship training schedules with Golden Rule hour tracking</p>
        </div>
        
        <div className="mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
            data-testid="create-plan-button"
          >
            Create New Plan
          </button>
        </div>
        
        <div className="bg-white rounded-xl border shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Import Schedule</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleJSONImport}
              className="hidden"
              data-testid="import-json-input"
            />
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/*"
              onChange={handleOCRFileSelect}
              className="hidden"
              data-testid="import-ocr-home-input"
            />
            <input
              ref={icsInputRef}
              type="file"
              accept=".ics,.ical,text/calendar,application/ics"
              onChange={handleICSFileSelect}
              className="hidden"
              data-testid="import-ics-home-input"
            />
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  navigate('/plan/new?csv=1');
                }
              }}
              className="hidden"
              data-testid="import-csv-home-input"
            />
            <button
              onClick={() => icsInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm font-medium"
              data-testid="import-ics-button"
            >
              Import ICS
            </button>
            <button
              onClick={() => setShowPasteICS(true)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm font-medium"
              data-testid="paste-ics-button"
            >
              Paste ICS
            </button>
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm font-medium"
              data-testid="import-screenshot-button"
            >
              Screenshot (OCR)
            </button>
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white text-sm font-medium"
              data-testid="import-json-button"
            >
              Import Backup
            </button>
          </div>
          <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50 text-center">
            <p className="text-sm text-gray-600">Drag and drop files here</p>
            <p className="text-xs text-gray-400 mt-1">Supports: .ics (calendar), .json (backup), .csv (spreadsheet), images (OCR)</p>
          </div>
        </div>
        
        {importError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm" data-testid="home-import-error">
            {importError}
            <button onClick={() => setImportError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}
        
        {importSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm" data-testid="home-import-success">
            {importSuccess}
            <button onClick={() => setImportSuccess(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Your Plans</h2>
          
          {state.plans.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
              <p className="text-lg font-medium text-gray-900 mb-2">Create your first plan</p>
              <p className="text-gray-500 mb-6 text-sm">Get started in three easy steps:</p>
              <div className="max-w-md mx-auto text-left mb-6">
                <p className="text-sm text-gray-600 mb-2">1. Create a new plan with your cohort name</p>
                <p className="text-sm text-gray-600 mb-2">2. Add blocks from the template library</p>
                <p className="text-sm text-gray-600">3. Publish the schedule for your students</p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                data-testid="create-first-plan-button"
              >
                Create Your First Plan
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {state.plans.map(plan => {
                const isPredictive = plan.settings.schedulerMode === 'predictive';
                const unassignedCount = plan.blocks.filter(b => b.templateId === null).length;
                return (
                  <div
                    key={plan.id}
                    className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between transition-all hover:shadow-md"
                    data-testid={`plan-card-${plan.id}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{plan.settings.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isPredictive 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isPredictive ? 'Predictive' : 'Manual'}
                        </span>
                        {plan.isPublished && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                            Published
                          </span>
                        )}
                        {!plan.isPublished && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Draft
                          </span>
                        )}
                        {unassignedCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {unassignedCount} unassigned
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {plan.settings.weeks} weeks | {plan.blocks.length} blocks
                        {plan.updatedAt && ` | Updated ${new Date(plan.updatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/plan/${plan.id}`)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        data-testid={`open-plan-${plan.id}`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteId(plan.id)}
                        className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                        data-testid={`delete-plan-${plan.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Plan">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Plan Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Cohort Spring 2025"
              data-testid="plan-name-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Number of Weeks</label>
            <input
              type="number"
              min={1}
              max={52}
              value={formData.weeks}
              onChange={e => setFormData({ ...formData, weeks: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="plan-weeks-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Scheduler Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, schedulerMode: 'manual' })}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  formData.schedulerMode === 'manual' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                data-testid="mode-manual-button"
              >
                <div className="font-medium text-sm">Manual Builder</div>
                <div className="text-xs text-gray-500 mt-1">Drag-and-drop schedule creation</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, schedulerMode: 'predictive' })}
                className={`p-3 border-2 rounded-lg text-left transition-colors ${
                  formData.schedulerMode === 'predictive' 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                data-testid="mode-predictive-button"
              >
                <div className="font-medium text-sm">Predictive Builder</div>
                <div className="text-xs text-gray-500 mt-1">AI-powered schedule suggestions</div>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="cancel-create-plan"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              data-testid="submit-create-plan"
            >
              Create Plan
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Plan"
        message="Are you sure you want to delete this plan? This action cannot be undone."
        confirmText="Delete"
      />

      {ocrProcessing && (
        <Modal open={true} onClose={() => {}} title="Processing Screenshot...">
          <div className="py-8 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm text-gray-600">
              Analyzing image with OCR... {ocrProgress}%
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        </Modal>
      )}

      {ocrEvents.length > 0 && !ocrProcessing && (
        <Modal open={true} onClose={() => { setOCREvents([]); setOCRPlanName(''); setOCRRawText(''); }} title="Screenshot Import Results">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1">OCR Has Limitations</p>
              <p className="text-amber-700">
                Screenshot scanning cannot reliably detect times from calendar grids. Detected titles are shown below.
                You can create draft blocks (titles only) and manually assign times in the schedule editor.
              </p>
              <div className="text-amber-600 text-xs mt-2 space-y-1">
                <p><strong>Better option:</strong> Export your calendar as ICS file instead:</p>
                <p>Google Calendar: Settings → Import & export → Export</p>
                <p>Outlook: File → Save Calendar → Save as ICS</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={ocrPlanName}
                onChange={e => setOCRPlanName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Imported Schedule"
                data-testid="ocr-plan-name-input"
              />
            </div>
            
            <div>
              <p className="text-sm text-gray-600 mb-2">
                {ocrEvents.length} text items detected:
              </p>
              <div className="max-h-36 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Detected Text (Title)</th>
                      <th className="p-2 text-left">Suggested Time</th>
                      <th className="p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrEvents.map(event => (
                      <tr key={event.id}>
                        <td className="p-2 truncate max-w-[150px]" title={event.title}>{event.title}</td>
                        <td className="p-2 text-gray-500">{event.startTime || '?'} - {event.endTime || '?'}</td>
                        <td className="p-2">
                          {event.startMinutes !== null ? (
                            <span className="text-green-600">Has time</span>
                          ) : (
                            <span className="text-amber-600">Set manually</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Show raw scanned text</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-24 whitespace-pre-wrap text-[10px]">
                {ocrRawText || 'No text detected'}
              </pre>
            </details>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setOCREvents([]); setOCRPlanName(''); setOCRRawText(''); }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlanFromOCR}
                disabled={!ocrPlanName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                data-testid="create-plan-from-ocr"
              >
                Create Draft Plan
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Blocks without detected times will be placed at 6:30 AM. Edit times in the schedule view.
            </p>
          </div>
        </Modal>
      )}

      {showPasteICS && (
        <Modal open={true} onClose={() => { setShowPasteICS(false); setPasteICSText(''); }} title="Paste ICS Calendar Text">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              If your file picker cannot find .ics files, you can paste the calendar content directly here.
              Open the .ics file in a text editor, copy all content, and paste below.
            </p>
            <textarea
              value={pasteICSText}
              onChange={e => setPasteICSText(e.target.value)}
              placeholder="BEGIN:VCALENDAR&#10;VERSION:2.0&#10;..."
              className="w-full h-48 px-3 py-2 border rounded font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="paste-ics-textarea"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowPasteICS(false); setPasteICSText(''); }}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteICSParse}
                disabled={!pasteICSText.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                data-testid="parse-pasted-ics"
              >
                Parse Calendar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingICSEvents.length > 0 && (
        <Modal open={true} onClose={clearICSImport} title="Import Calendar Events">
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <p className="text-green-800">
                Found {pendingICSEvents.length} events in the calendar!
              </p>
              {icsMinDate && icsMaxDate && (
                <p className="text-green-600 text-xs mt-1">
                  Events span from {icsMinDate.toLocaleDateString()} to {icsMaxDate.toLocaleDateString()}
                </p>
              )}
              {icsDetectedTimezone && (
                <p className="text-green-600 text-xs">
                  Detected timezone: {icsDetectedTimezone} (displaying in your local time)
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={icsImportPlanName}
                onChange={e => setIcsImportPlanName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Imported Schedule"
                data-testid="ics-plan-name-input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Date Range</label>
              <select
                value={icsDateRangeMode}
                onChange={e => handleDateRangeModeChange(e.target.value as DateRangeMode)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="ics-date-range-mode"
              >
                <option value="all">All dates</option>
                <option value="range">Select range</option>
                <option value="week">Single week (Mon-Sun)</option>
              </select>
            </div>
            
            {icsDateRangeMode !== 'all' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={icsStartDate}
                    onChange={e => setIcsStartDate(e.target.value)}
                    min={icsMinDateStr}
                    max={icsEndDate}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ics-start-date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={icsEndDate}
                    onChange={e => setIcsEndDate(e.target.value)}
                    min={icsStartDate}
                    max={icsMaxDateStr}
                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="ics-end-date"
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={icsIncludeOutsideHours}
                  onChange={e => setIcsIncludeOutsideHours(e.target.checked)}
                  className="rounded"
                  data-testid="ics-include-outside-hours"
                />
                Include events outside 6:30 AM - 3:30 PM ({outsideHoursCount} events)
              </label>
            </div>
            
            {roundedEventsCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 font-medium">{roundedEventsCount} events will be rounded to 15-minute increments</p>
                    <p className="text-amber-700 text-xs mt-1">Times not on 15-minute boundaries are adjusted. Review the preview below.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">
                  Preview ({filteredICSEvents.length} events):
                </p>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAllEvents} className="text-blue-600 hover:underline">Select all</button>
                  <button onClick={deselectAllEvents} className="text-blue-600 hover:underline">Clear selection</button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Title</th>
                      <th className="p-2 text-left w-48">Category (double-click to assign)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredICSEvents.slice(0, 50).map(event => {
                      const startHour = event.dtstart.getHours();
                      const startMin = event.dtstart.getMinutes();
                      const endHour = event.dtend.getHours();
                      const endMin = event.dtend.getMinutes();
                      const suggestion = icsTemplateSuggestions[event.uid];
                      const assignedTemplateId = getEventAssignedTemplate(event.uid);
                      const assignedTemplate = assignedTemplateId 
                        ? state.templates.find(t => t.id === assignedTemplateId)
                        : null;
                      const isExpanded = expandedEventId === event.uid;
                      const confidence = suggestion?.match.confidence || 0;
                      const hasMultipleCandidates = (suggestion?.candidates.length || 0) > 1;
                      
                      return (
                        <tr 
                          key={event.uid} 
                          className={`${icsSelectedEvents.has(event.uid) ? 'bg-blue-50' : event.wasRounded ? 'bg-amber-50' : ''} ${isExpanded ? 'border-b-0' : ''}`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={icsSelectedEvents.has(event.uid)}
                              onChange={() => toggleEventSelection(event.uid)}
                              className="rounded"
                            />
                          </td>
                          <td className="p-2">{event.dtstart.toLocaleDateString()}</td>
                          <td className="p-2 whitespace-nowrap">
                            {startHour % 12 || 12}:{startMin.toString().padStart(2, '0')} {startHour >= 12 ? 'PM' : 'AM'} - 
                            {endHour % 12 || 12}:{endMin.toString().padStart(2, '0')} {endHour >= 12 ? 'PM' : 'AM'}
                          </td>
                          <td className="p-2 max-w-[120px]">
                            <span className="block truncate" title={event.summary}>{event.summary}</span>
                          </td>
                          <td className="p-2">
                            <div 
                              className="cursor-pointer"
                              onDoubleClick={() => setExpandedEventId(isExpanded ? null : event.uid)}
                            >
                              {assignedTemplate ? (
                                <div className="flex items-center gap-1">
                                  <span 
                                    className="w-2 h-2 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: assignedTemplate.colorHex }}
                                  />
                                  <span className="text-green-700 font-medium truncate" title={assignedTemplate.title}>
                                    {assignedTemplate.title.slice(0, 18)}
                                  </span>
                                  {confidence >= 0.9 && <span className="text-green-500 text-[10px]">auto</span>}
                                </div>
                              ) : hasMultipleCandidates ? (
                                <div className="text-amber-600">
                                  <span className="font-medium">{suggestion?.candidates.length} options</span>
                                  <span className="text-[10px] ml-1">(dbl-click)</span>
                                </div>
                              ) : suggestion?.candidates[0] ? (
                                <div className="text-blue-600">
                                  <span className="truncate">{suggestion.candidates[0].templateTitle.slice(0, 15)}?</span>
                                  <span className="text-[10px] ml-1">({Math.round(confidence * 100)}%)</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No match (dbl-click)</span>
                              )}
                            </div>
                            
                            {isExpanded && (
                              <div className="mt-2 bg-white border rounded shadow-lg p-2 absolute z-10 w-64">
                                <p className="text-xs font-medium mb-2">Assign "{event.summary.slice(0, 25)}..." to:</p>
                                <div className="max-h-40 overflow-auto space-y-1">
                                  {suggestion?.candidates.map(c => (
                                    <button
                                      key={c.templateId}
                                      onClick={() => assignTemplateToEvent(event.uid, c.templateId)}
                                      className="w-full text-left px-2 py-1 text-xs rounded hover:bg-blue-50 flex items-center gap-2"
                                    >
                                      <span 
                                        className="w-2 h-2 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: state.templates.find(t => t.id === c.templateId)?.colorHex || '#999' }}
                                      />
                                      <span className="flex-1 truncate">{c.templateTitle}</span>
                                      <span className="text-gray-400">{Math.round(c.score * 100)}%</span>
                                    </button>
                                  ))}
                                  <hr className="my-1" />
                                  <select
                                    className="w-full text-xs border rounded px-1 py-1"
                                    value=""
                                    onChange={(e) => {
                                      if (e.target.value) assignTemplateToEvent(event.uid, e.target.value);
                                    }}
                                  >
                                    <option value="">Other templates...</option>
                                    {state.templates.map(t => (
                                      <option key={t.id} value={t.id}>{t.title}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => assignTemplateToEvent(event.uid, null)}
                                    className="w-full text-left px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                                  >
                                    Leave unassigned
                                  </button>
                                </div>
                                <button
                                  onClick={() => setExpandedEventId(null)}
                                  className="mt-2 w-full text-xs text-gray-500 hover:underline"
                                >
                                  Close
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredICSEvents.length > 30 && (
                  <p className="p-2 text-center text-gray-500">...and {filteredICSEvents.length - 30} more events</p>
                )}
                {filteredICSEvents.length === 0 && (
                  <p className="p-4 text-center text-gray-500">No events match the current filters</p>
                )}
              </div>
            </div>
            
            {icsSelectedEvents.size > 0 && (
              <div className="bg-gray-50 border rounded p-3 text-sm">
                <p className="font-medium mb-2">Bulk edit {icsSelectedEvents.size} selected events:</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Resource</label>
                    <select
                      value={icsBulkResource}
                      onChange={e => setIcsBulkResource(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Choose...</option>
                      {DEFAULT_RESOURCES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Category</label>
                    <select
                      value={icsBulkBucketId}
                      onChange={e => setIcsBulkBucketId(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">Choose...</option>
                      {GOLDEN_RULE_BUCKETS.map(b => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleBulkApply}
                    disabled={icsBulkResource === '' && icsBulkBucketId === ''}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    data-testid="ics-bulk-apply"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={clearICSImport}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlanFromICS}
                disabled={!icsImportPlanName.trim() || filteredICSEvents.length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                data-testid="create-plan-from-ics"
              >
                Create Plan ({filteredICSEvents.length} events)
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
