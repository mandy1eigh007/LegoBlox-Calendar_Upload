import { useState, useRef, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES, AppState, PlacedBlock, Day, DAYS, GOLDEN_RULE_BUCKETS, SchedulerMode, AnchorPromptId } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { createDefaultPlanSettings } from '@/lib/storage';
import { ANCHOR_PROMPTS, createAnchorSelections, createEmptyAnchorChecklist, buildAnchorDateDraft, buildAnchorWeeklyDraft, buildBlocksFromDraft, AnchorScheduleSelection } from '@/lib/anchorPrompts';
import { getWeekDayFromDate } from '@/lib/dateMapping';
import { v4 as uuidv4 } from 'uuid';
import { validateAppState } from '@/state/validators';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { parseICSWithDateRange, convertICSEventsToBlocks, ICSEventWithDate, importCSVToBlocks, getCSVHeaders, CSVDraftEvent } from '@/lib/csv';
import { resolveTemplateForImportedTitle, TemplateCandidate, getBucketLabel } from '@/lib/templateMatcher';
import { minutesToTimeDisplay } from '@/lib/time';
import { Loader2, AlertTriangle } from 'lucide-react';

type DateRangeMode = 'all' | 'range' | 'week';
type ImportTarget = 'new' | 'existing';
type OCRDraft = OCREvent & {
  confirmed: boolean;
  titleInput: string;
  dayInput: Day | null;
  startMinutesInput: number | null;
  endMinutesInput: number | null;
};
type CsvColumnMapping = {
  week: number;
  day: number;
  startTime: number;
  endTime: number;
  title: number;
  location: number;
  notes: number;
};
type CsvMappingPreset = { name: string; mapping: CsvColumnMapping; headers?: string[] };

const CSV_PRESET_STORAGE_KEY = 'homeCsvMappingPresets';

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
  const [ocrDrafts, setOCRDrafts] = useState<OCRDraft[]>([]);
  const [ocrPlanName, setOCRPlanName] = useState('');
  const [ocrRawText, setOCRRawText] = useState('');
  const [ocrConfirmError, setOcrConfirmError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEvents, setManualEvents] = useState<Array<{id: string; title: string; day: Day; startMinutes: number; durationMinutes: number}>>([]);
  const [anchorChecklist, setAnchorChecklist] = useState<Record<AnchorPromptId, boolean>>(createEmptyAnchorChecklist());
  const [anchorSelections, setAnchorSelections] = useState<Record<AnchorPromptId, AnchorScheduleSelection>>(
    createAnchorSelections(390)
  );
  const [createPlanError, setCreatePlanError] = useState<string | null>(null);
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
  const [csvContent, setCSVContent] = useState<string | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvMapping, setCSVMapping] = useState<CsvColumnMapping>({
    week: 1,
    day: 2,
    startTime: 3,
    endTime: 4,
    title: 5,
    location: 8,
    notes: 9,
  });
  const [csvDrafts, setCSVDrafts] = useState<CSVDraftEvent[]>([]);
  const [csvPlanName, setCsvPlanName] = useState('');
  const [lockCsvEvents, setLockCsvEvents] = useState(true);
  const [lockIcsEvents, setLockIcsEvents] = useState(true);
  const [csvPresets, setCsvPresets] = useState<CsvMappingPreset[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(CSV_PRESET_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as CsvMappingPreset[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedCsvPreset, setSelectedCsvPreset] = useState('');
  const [csvPresetName, setCsvPresetName] = useState('');
  const [csvPresetNotice, setCsvPresetNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CSV_PRESET_STORAGE_KEY, JSON.stringify(csvPresets));
    } catch {}
  }, [csvPresets]);

  useEffect(() => {
    if (!showCreate) return;
    setAnchorChecklist(createEmptyAnchorChecklist());
    setAnchorSelections(createAnchorSelections(formData.dayStartMinutes, formData.startDate, formData.activeDays, formData.weeks));
    setCreatePlanError(null);
  }, [showCreate, formData.dayStartMinutes, formData.startDate, formData.activeDays, formData.weeks]);

  const normalizeCsvHeaders = (headers: string[]) => headers.map(h => h.trim().toLowerCase());
  const headersMatch = (a: string[], b: string[]) => a.length === b.length && a.every((h, i) => h === b[i]);

  const timeOptions = useMemo(() => {
    const options: number[] = [];
    for (let m = 390; m <= 930; m += 15) {
      options.push(m);
    }
    return options;
  }, []);

  const normalizeOcrMinutes = (value: number | null): number | null => {
    if (value === null || Number.isNaN(value)) return null;
    const rounded = Math.round(value / 15) * 15;
    if (rounded < 390 || rounded > 930) return null;
    return rounded;
  };

  const updateOcrDraft = (id: string, updates: Partial<OCRDraft>) => {
    setOCRDrafts(prev => prev.map(draft => {
      if (draft.id !== id) return draft;
      const next = { ...draft, ...updates };
      if (!isDraftValid(next)) {
        next.confirmed = false;
      }
      return next;
    }));
  };

  const isDraftValid = (draft: OCRDraft): boolean => {
    if (!draft.titleInput.trim()) return false;
    if (!draft.dayInput) return false;
    if (draft.startMinutesInput === null || draft.endMinutesInput === null) return false;
    return draft.endMinutesInput > draft.startMinutesInput;
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    setCreatePlanError(null);

    const anchorSchedule: PlanSettings['anchorSchedule'] = {};
    const anchorBlocks: PlacedBlock[] = [];
    const nextAnchorChecklist = { ...anchorChecklist };
    const warnings: string[] = [];

    for (const prompt of ANCHOR_PROMPTS) {
      const selection = anchorSelections[prompt.id];
      if (!selection || !selection.enabled) {
        nextAnchorChecklist[prompt.id] = false;
        continue;
      }

      nextAnchorChecklist[prompt.id] = true;
      if (selection.mode === 'weekly' && selection.weekly) {
        const weeklyDraft = buildAnchorWeeklyDraft(prompt, selection.weekly);
        anchorSchedule[prompt.id] = [weeklyDraft];
        if (selection.weekly.createNow) {
          const result = buildBlocksFromDraft(
            weeklyDraft,
            state.templates,
            formData.startDate,
            formData.activeDays,
            formData.weeks
          );
          if (result.warnings.length > 0) {
            warnings.push(`${prompt.defaultTitle}: ${result.warnings.join(' ')}`);
          }
          anchorBlocks.push(...result.blocks);
        }
      } else {
        const rows = selection.rows.filter(row => row.date);
        const drafts = rows.map(row => buildAnchorDateDraft(prompt, row));
        anchorSchedule[prompt.id] = drafts;

        for (const draft of drafts) {
          const row = selection.rows.find(r => r.id === draft.id);
          if (!row?.createNow) continue;
          const result = buildBlocksFromDraft(
            draft,
            state.templates,
            formData.startDate,
            formData.activeDays,
            formData.weeks
          );
          if (result.warnings.length > 0) {
            warnings.push(`${prompt.defaultTitle}: ${result.warnings.join(' ')}`);
            continue;
          }
          anchorBlocks.push(...result.blocks);
        }
      }
    }

    if (warnings.length > 0) {
      setCreatePlanError(warnings.join(' '));
      return;
    }
    
    const plan: Plan = {
      id: uuidv4(),
      settings: { 
        ...formData, 
        anchorChecklist: nextAnchorChecklist,
        anchorSchedule,
        anchorWizardDismissed: false,
      },
      blocks: anchorBlocks,
      recurrenceSeries: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setShowCreate(false);
    setFormData(createDefaultPlanSettings());
    setAnchorChecklist(createEmptyAnchorChecklist());
    setAnchorSelections(createAnchorSelections(formData.dayStartMinutes, formData.startDate, formData.activeDays, formData.weeks));
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
    setOcrConfirmError(null);

    try {
      const { events, rawText } = await processImageWithOCR(file, setOCRProgress);
      const drafts: OCRDraft[] = events.map(event => ({
        ...event,
        confirmed: false,
        titleInput: event.title || 'Untitled',
        dayInput: event.day,
        startMinutesInput: normalizeOcrMinutes(event.startMinutes),
        endMinutesInput: normalizeOcrMinutes(event.endMinutes),
      }));
      setOCRDrafts(drafts);
      setOCRRawText(rawText);
      setOCRPlanName(`Imported from ${file.name.replace(/\.[^/.]+$/, '')}`);
      
      if (events.length === 0) {
        setImportError('No schedule events detected. Screenshot import works best with clear text. For Google Calendar, try exporting as ICS instead (Calendar Settings → Export).');
        setOCRDrafts([]);
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
    if (!ocrPlanName.trim() || ocrDrafts.length === 0) return;

    const confirmedDrafts = ocrDrafts.filter(draft => draft.confirmed && isDraftValid(draft));
    if (confirmedDrafts.length === 0) {
      setOcrConfirmError('Confirm at least one event with a valid title, day, start time, and end time.');
      return;
    }

    const blocks: PlacedBlock[] = [];
    for (const draft of confirmedDrafts) {
      const startMinutes = draft.startMinutesInput!;
      const endMinutes = draft.endMinutesInput!;
      let durationMinutes = endMinutes - startMinutes;
      durationMinutes = Math.max(15, Math.ceil(durationMinutes / 15) * 15);

      const matchResult = resolveTemplateForImportedTitle(draft.titleInput, state.templates);
      const matchedTemplate = matchResult.templateId ? state.templates.find(t => t.id === matchResult.templateId) : null;

      blocks.push({
        id: uuidv4(),
        templateId: matchResult.templateId,
        week: 1,
        day: draft.dayInput || 'Monday',
        startMinutes,
        durationMinutes,
        titleOverride: draft.titleInput,
        location: '',
        notes: `OCR confirmed: ${draft.rawText}`,
        countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
        goldenRuleBucketId: matchedTemplate ? matchedTemplate.goldenRuleBucketId : null,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
        isLocked: false,
      });
    }

    const plan: Plan = {
      id: uuidv4(),
      settings: { ...createDefaultPlanSettings(), name: ocrPlanName },
      blocks,
      recurrenceSeries: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setOCRDrafts([]);
    setOCRPlanName('');
    setOCRRawText('');
    setOcrConfirmError(null);
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

  const handleCSVImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const headers = getCSVHeaders(content);
        if (headers.length === 0) {
          setImportError('CSV file must include a header row.');
          setImportSuccess(null);
          return;
        }

        const mapping = {
          week: 1,
          day: 2,
          startTime: 3,
          endTime: 4,
          title: 5,
          location: 8,
          notes: 9,
        };

        headers.forEach((h, i) => {
          const lowerH = h.toLowerCase();
          if (lowerH.includes('week')) mapping.week = i;
          else if (lowerH.includes('day')) mapping.day = i;
          else if (lowerH.includes('start')) mapping.startTime = i;
          else if (lowerH.includes('end')) mapping.endTime = i;
          else if (lowerH.includes('title') || lowerH.includes('name') || lowerH.includes('event')) mapping.title = i;
          else if (lowerH.includes('location') || lowerH.includes('room')) mapping.location = i;
          else if (lowerH.includes('note') || lowerH.includes('description')) mapping.notes = i;
        });

        const normalizedHeaders = normalizeCsvHeaders(headers);
        const matchingPreset = csvPresets.find(preset => preset.headers && headersMatch(preset.headers, normalizedHeaders));
        const appliedMapping = matchingPreset ? matchingPreset.mapping : mapping;

        setCSVContent(content);
        setCSVHeaders(headers);
        setCSVMapping(appliedMapping);
        setCsvPlanName(`Imported from ${file.name.replace(/\.[^/.]+$/, '')}`);
        setCSVDrafts([]);
        setSelectedCsvPreset(matchingPreset ? matchingPreset.name : '');
        setCsvPresetName('');
        setCsvPresetNotice(
          matchingPreset
            ? `Auto-applied mapping preset "${matchingPreset.name}" based on matching headers.`
            : null
        );
        setLockCsvEvents(true);
        setImportError(null);
        setImportSuccess(null);
      } catch (err) {
        setImportError('Failed to parse CSV file.');
        setImportSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  const handleCSVPreview = () => {
    if (!csvContent) return;
    const { drafts, errors } = importCSVToBlocks(csvContent, csvMapping);
    if (errors.length > 0) {
      setImportError(errors.join('; '));
      return;
    }
    if (drafts.length === 0) {
      setImportError('No events found in CSV file.');
      return;
    }
    setCSVDrafts(drafts);
    setImportError(null);
  };

  const handleApplyCSVDrafts = () => {
    if (csvDrafts.length === 0) return;
    if (!csvPlanName.trim()) {
      setImportError('Plan name is required.');
      return;
    }

    const maxWeek = Math.max(...csvDrafts.map(d => d.week), 1);
    const blocks: PlacedBlock[] = csvDrafts.map(draft => {
      const match = resolveTemplateForImportedTitle(draft.title, state.templates);
      const matchedTemplate = match.templateId ? state.templates.find(t => t.id === match.templateId) : null;
      const warningNote = draft.needsReview && draft.warning ? `CSV Import Warning: ${draft.warning}` : '';
      const notes = [draft.notes, warningNote].filter(Boolean).join('\n');
      return {
        id: uuidv4(),
        templateId: match.templateId,
        week: draft.week,
        day: draft.day,
        startMinutes: draft.startMinutes,
        durationMinutes: draft.durationMinutes,
        titleOverride: draft.title,
        location: draft.location,
        notes,
        countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
        goldenRuleBucketId: matchedTemplate ? matchedTemplate.goldenRuleBucketId : null,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
        isLocked: lockCsvEvents,
      };
    });

    const defaults = createDefaultPlanSettings();
    const plan: Plan = {
      id: uuidv4(),
      settings: { ...defaults, name: csvPlanName.trim(), weeks: Math.max(defaults.weeks, maxWeek) },
      blocks,
      recurrenceSeries: [],
    };

    const unassignedCount = blocks.filter(b => b.templateId === null).length;
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setImportError(null);
    setImportSuccess(
      unassignedCount > 0
        ? `Imported ${blocks.length} events (${unassignedCount} unassigned).`
        : `Imported ${blocks.length} events from CSV.`
    );
    setCSVContent(null);
    setCSVHeaders([]);
    setCSVDrafts([]);
    setCsvPlanName('');
    navigate(`/plan/${plan.id}`);
  };

  const cancelCSVImport = () => {
    setCSVContent(null);
    setCSVHeaders([]);
    setCSVDrafts([]);
    setCsvPlanName('');
    setCSVMapping({
      week: 1,
      day: 2,
      startTime: 3,
      endTime: 4,
      title: 5,
      location: 8,
      notes: 9,
    });
    setLockCsvEvents(true);
    setSelectedCsvPreset('');
    setCsvPresetName('');
    setCsvPresetNotice(null);
    setImportError(null);
  };

  const handleSelectCsvPreset = (name: string) => {
    setSelectedCsvPreset(name);
    const preset = csvPresets.find(p => p.name === name);
    if (preset) {
      setCSVMapping(preset.mapping);
      setCsvPresetNotice(`Applied mapping preset "${preset.name}".`);
    } else {
      setCsvPresetNotice(null);
    }
  };

  const handleSaveCsvPreset = () => {
    const name = csvPresetName.trim();
    if (!name) {
      setCsvPresetNotice('Enter a name to save this mapping.');
      return;
    }
    const headerSignature = csvHeaders.length > 0 ? normalizeCsvHeaders(csvHeaders) : [];
    const next: CsvMappingPreset = { name, mapping: { ...csvMapping }, headers: headerSignature };
    setCsvPresets(prev => {
      const without = prev.filter(p => p.name !== name);
      return [...without, next];
    });
    setSelectedCsvPreset(name);
    setCsvPresetNotice('Saved mapping preset.');
  };

  const handleDeleteCsvPreset = () => {
    if (!selectedCsvPreset) return;
    setCsvPresets(prev => prev.filter(p => p.name !== selectedCsvPreset));
    setSelectedCsvPreset('');
    setCsvPresetNotice('Deleted mapping preset.');
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
    
    const finalBlocks = blocksWithAssignments.map(block => ({
      ...block,
      isLocked: lockIcsEvents,
    }));

    const plan: Plan = {
      id: uuidv4(),
      settings: { ...createDefaultPlanSettings(), name: icsImportPlanName },
      blocks: finalBlocks,
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
    setLockIcsEvents(true);
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
    } else if (fileName.endsWith('.csv') || fileType === 'text/csv') {
      handleCSVImport(file);
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
      setImportError(`Unsupported file type. Drag an ICS, CSV, JSON, or image file.`);
    }
  };

  return (
    <div 
      className="min-h-screen p-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 bg-purple-500/20 border-4 border-dashed border-purple-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="glass-card rounded-lg p-8 shadow-lg text-center">
            <p className="text-lg font-medium text-foreground">Drop your file here</p>
            <p className="text-sm text-muted-foreground">ICS, JSON, or image files</p>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">Cohort Schedule Builder</h1>
          <p className="text-muted-foreground mt-1">Plan and manage pre-apprenticeship training schedules with Golden Rule hour tracking</p>
        </div>
        
        <div className="mb-6">
          <button
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium glow-primary transition-all"
            data-testid="create-plan-button"
          >
            Create New Plan
          </button>
        </div>
        
        <div className="glass-card rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-foreground mb-4">Import Schedule</h2>
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
                  handleCSVImport(file);
                }
                if (csvInputRef.current) {
                  csvInputRef.current.value = '';
                }
              }}
              className="hidden"
              data-testid="import-csv-home-input"
            />
            <button
              onClick={() => icsInputRef.current?.click()}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary/50 text-foreground text-sm font-medium transition-all"
              data-testid="import-ics-button"
            >
              Import ICS
            </button>
            <button
              onClick={() => setShowPasteICS(true)}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary/50 text-foreground text-sm font-medium transition-all"
              data-testid="paste-ics-button"
            >
              Paste ICS
            </button>
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary/50 text-foreground text-sm font-medium transition-all"
              data-testid="import-screenshot-button"
            >
              Screenshot (OCR)
            </button>
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2 border border-border rounded-lg hover:bg-secondary/50 text-foreground text-sm font-medium transition-all"
              data-testid="import-json-button"
            >
              Import Backup
            </button>
          </div>
          <div className="p-4 border-2 border-dashed border-purple-500/30 rounded-lg bg-purple-500/5 text-center">
            <p className="text-sm text-muted-foreground">Drag and drop files here</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Supports: .ics (calendar), .json (backup), .csv (spreadsheet), images (OCR)</p>
          </div>
        </div>
        
        {importError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-300 text-sm" data-testid="home-import-error">
            {importError}
            <button onClick={() => setImportError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}
        
        {importSuccess && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm" data-testid="home-import-success">
            {importSuccess}
            <button onClick={() => setImportSuccess(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        <div className="mb-6">
          <h2 className="font-semibold text-foreground mb-4">Your Plans</h2>
          
          {state.plans.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-lg font-medium text-foreground mb-2">Create your first plan</p>
              <p className="text-muted-foreground mb-6 text-sm">Get started in three easy steps:</p>
              <div className="max-w-md mx-auto text-left mb-6">
                <p className="text-sm text-muted-foreground mb-2">1. Create a new plan with your cohort name</p>
                <p className="text-sm text-muted-foreground mb-2">2. Add blocks from the template library</p>
                <p className="text-sm text-muted-foreground">3. Publish the schedule for your students</p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium glow-primary transition-all"
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
                    className="glass-card rounded-xl p-5 flex items-center justify-between transition-all hover:glow-primary"
                    data-testid={`plan-card-${plan.id}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{plan.settings.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPredictive 
                            ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                        }`}>
                          {isPredictive ? 'Predictive' : 'Manual'}
                        </span>
                        {plan.isPublished && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-300">
                            Published
                          </span>
                        )}
                        {!plan.isPublished && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 border border-gray-300">
                            Draft
                          </span>
                        )}
                        {unassignedCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-300">
                            {unassignedCount} unassigned
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.settings.weeks} weeks | {plan.blocks.length} blocks
                        {plan.updatedAt && ` | Updated ${new Date(plan.updatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/plan/${plan.id}`)}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium glow-primary transition-all"
                        data-testid={`open-plan-${plan.id}`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setDeleteId(plan.id)}
                        className="px-3 py-2 text-sm border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-all"
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

      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setAnchorChecklist(createEmptyAnchorChecklist());
          setAnchorSelections(createAnchorSelections(formData.dayStartMinutes, formData.startDate, formData.activeDays, formData.weeks));
        }}
        title="Create New Plan"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Plan Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Cohort Spring 2025"
              data-testid="plan-name-input"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Number of Weeks</label>
            <input
              type="number"
              min={1}
              max={52}
              value={formData.weeks}
              onChange={e => setFormData({ ...formData, weeks: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="plan-weeks-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Cohort Start Date</label>
            <input
              type="date"
              value={formData.startDate || ''}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground"
              data-testid="plan-start-date-input"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Active Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(day => (
                <label key={day} className="flex items-center gap-2 text-xs text-foreground border border-border rounded-lg px-2 py-1">
                  <input
                    type="checkbox"
                    checked={formData.activeDays?.includes(day)}
                    onChange={e => {
                      const activeDays = new Set(formData.activeDays || DAYS);
                      if (e.target.checked) {
                        activeDays.add(day);
                      } else {
                        activeDays.delete(day);
                      }
                      const nextDays = Array.from(activeDays);
                      setFormData({ ...formData, activeDays: nextDays.length > 0 ? nextDays : [day] });
                    }}
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] })}
                className="text-xs px-2 py-1 border border-border rounded-lg text-foreground hover:bg-secondary/50"
              >
                Mon–Thu
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, activeDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] })}
                className="text-xs px-2 py-1 border border-border rounded-lg text-foreground hover:bg-secondary/50"
              >
                Tue–Fri
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Scheduler Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, schedulerMode: 'manual' })}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  formData.schedulerMode === 'manual' 
                    ? 'border-primary bg-primary/10 glow-primary' 
                    : 'border-border hover:border-primary/50'
                }`}
                data-testid="mode-manual-button"
              >
                <div className="font-medium text-sm text-foreground">Manual Builder</div>
                <div className="text-xs text-muted-foreground mt-1">Drag-and-drop schedule creation</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, schedulerMode: 'predictive' })}
                className={`p-3 border-2 rounded-lg text-left transition-all ${
                  formData.schedulerMode === 'predictive' 
                    ? 'border-accent bg-accent/10 glow-accent' 
                    : 'border-border hover:border-accent/50'
                }`}
                data-testid="mode-predictive-button"
              >
                <div className="font-medium text-sm text-foreground">Predictive Builder</div>
                <div className="text-xs text-muted-foreground mt-1">AI-powered schedule suggestions</div>
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">Anchor schedule prompts</p>
              <p className="text-xs text-muted-foreground">
                These items depend on partner schedules. Check anything already scheduled so you remember to lock them in first.
              </p>
            </div>
            <div className="space-y-2">
              {ANCHOR_PROMPTS.map(prompt => (
                <div key={prompt.id} className="rounded border border-border bg-background/40 p-2">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={anchorChecklist[prompt.id]}
                      onChange={e => {
                        const next = { ...anchorChecklist, [prompt.id]: e.target.checked };
                        setAnchorChecklist(next);
                        const existingSelection = anchorSelections[prompt.id];
                        setAnchorSelections({
                          ...anchorSelections,
                          [prompt.id]: {
                            ...existingSelection,
                            enabled: e.target.checked,
                            rows: existingSelection.rows.map(row => ({
                              ...row,
                              createNow: e.target.checked ? row.createNow : false,
                            })),
                            weekly: existingSelection.weekly
                              ? {
                                  ...existingSelection.weekly,
                                  createNow: e.target.checked ? existingSelection.weekly.createNow : false,
                                }
                              : undefined,
                          },
                        });
                      }}
                    />
                    {prompt.label}
                  </label>
                  {anchorChecklist[prompt.id] && (
                    <div className="mt-2 space-y-3">
                      {prompt.supportsWeekly && (
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setAnchorSelections({
                              ...anchorSelections,
                              [prompt.id]: { ...anchorSelections[prompt.id], mode: 'weekly' },
                            })}
                            className={`px-2 py-1 rounded border ${
                              anchorSelections[prompt.id].mode === 'weekly'
                                ? 'border-accent text-accent'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            Weekly schedule
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnchorSelections({
                              ...anchorSelections,
                              [prompt.id]: { ...anchorSelections[prompt.id], mode: 'dates' },
                            })}
                            className={`px-2 py-1 rounded border ${
                              anchorSelections[prompt.id].mode === 'dates'
                                ? 'border-accent text-accent'
                                : 'border-border text-muted-foreground'
                            }`}
                          >
                            Specific dates
                          </button>
                        </div>
                      )}

                      {anchorSelections[prompt.id].mode === 'weekly' && prompt.supportsWeekly && anchorSelections[prompt.id].weekly && (
                        <div className="border border-border rounded-lg p-2 space-y-2 text-xs">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={anchorSelections[prompt.id].weekly?.createNow}
                              onChange={e => setAnchorSelections({
                                ...anchorSelections,
                                [prompt.id]: {
                                  ...anchorSelections[prompt.id],
                                  weekly: anchorSelections[prompt.id].weekly
                                    ? { ...anchorSelections[prompt.id].weekly!, createNow: e.target.checked }
                                    : undefined,
                                },
                              })}
                            />
                            Create locked events now
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-muted-foreground mb-1">Start week</label>
                              <input
                                type="number"
                                min={1}
                                max={formData.weeks}
                                value={anchorSelections[prompt.id].weekly?.startWeek || 1}
                                onChange={e => setAnchorSelections({
                                  ...anchorSelections,
                                  [prompt.id]: {
                                    ...anchorSelections[prompt.id],
                                    weekly: anchorSelections[prompt.id].weekly
                                      ? { ...anchorSelections[prompt.id].weekly!, startWeek: parseInt(e.target.value) || 1 }
                                      : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 border rounded bg-input"
                              />
                            </div>
                            <div>
                              <label className="block text-muted-foreground mb-1">End week</label>
                              <input
                                type="number"
                                min={1}
                                max={formData.weeks}
                                value={anchorSelections[prompt.id].weekly?.endWeek || formData.weeks}
                                onChange={e => setAnchorSelections({
                                  ...anchorSelections,
                                  [prompt.id]: {
                                    ...anchorSelections[prompt.id],
                                    weekly: anchorSelections[prompt.id].weekly
                                      ? { ...anchorSelections[prompt.id].weekly!, endWeek: parseInt(e.target.value) || formData.weeks }
                                      : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 border rounded bg-input"
                              />
                            </div>
                            <div>
                              <label className="block text-muted-foreground mb-1">Start Time</label>
                              <select
                                value={anchorSelections[prompt.id].weekly?.startMinutes}
                                onChange={e => setAnchorSelections({
                                  ...anchorSelections,
                                  [prompt.id]: {
                                    ...anchorSelections[prompt.id],
                                    weekly: anchorSelections[prompt.id].weekly
                                      ? { ...anchorSelections[prompt.id].weekly!, startMinutes: parseInt(e.target.value) }
                                      : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 border rounded bg-input"
                              >
                                {timeOptions.map(m => (
                                  <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-muted-foreground mb-1">Duration (min)</label>
                              <input
                                type="number"
                                min={15}
                                step={15}
                                value={anchorSelections[prompt.id].weekly?.durationMinutes || 60}
                                onChange={e => setAnchorSelections({
                                  ...anchorSelections,
                                  [prompt.id]: {
                                    ...anchorSelections[prompt.id],
                                    weekly: anchorSelections[prompt.id].weekly
                                      ? { ...anchorSelections[prompt.id].weekly!, durationMinutes: parseInt(e.target.value) || 60 }
                                      : undefined,
                                  },
                                })}
                                className="w-full px-2 py-1 border rounded bg-input"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-muted-foreground mb-1">Days</label>
                            <div className="flex flex-wrap gap-2">
                              {(formData.activeDays || DAYS).map(day => (
                                <label key={day} className="flex items-center gap-1 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={anchorSelections[prompt.id].weekly?.days.includes(day)}
                                    onChange={e => {
                                      const nextDays = new Set(anchorSelections[prompt.id].weekly?.days || []);
                                      if (e.target.checked) {
                                        nextDays.add(day);
                                      } else {
                                        nextDays.delete(day);
                                      }
                                      setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          weekly: anchorSelections[prompt.id].weekly
                                            ? { ...anchorSelections[prompt.id].weekly!, days: Array.from(nextDays) }
                                            : undefined,
                                        },
                                      });
                                    }}
                                  />
                                  {day.slice(0, 3)}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {anchorSelections[prompt.id].mode === 'dates' && (
                        <div className="space-y-2">
                          {anchorSelections[prompt.id]?.rows.map(row => {
                            const placement = row.date ? getWeekDayFromDate(row.date, formData.startDate) : null;
                            const showWarning = placement?.isWeekend ||
                              (placement && formData.activeDays && formData.activeDays.length > 0 && !formData.activeDays.includes(placement.day));
                            return (
                              <div key={row.id} className="border border-border rounded-lg p-2 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <input
                                      type="checkbox"
                                      checked={row.createNow}
                                      onChange={e => setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          rows: anchorSelections[prompt.id].rows.map(r => r.id === row.id ? { ...r, createNow: e.target.checked } : r),
                                        },
                                      })}
                                    />
                                    Create locked event now
                                  </label>
                                  {anchorSelections[prompt.id].rows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          rows: anchorSelections[prompt.id].rows.filter(r => r.id !== row.id),
                                        },
                                      })}
                                      className="text-xs text-red-400"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="block text-muted-foreground mb-1">Date</label>
                                    <input
                                      type="date"
                                      value={row.date}
                                      onChange={e => setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          rows: anchorSelections[prompt.id].rows.map(r => r.id === row.id ? { ...r, date: e.target.value } : r),
                                        },
                                      })}
                                      className="w-full px-2 py-1 border rounded bg-input"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-muted-foreground mb-1">Start Time</label>
                                    <select
                                      value={row.startMinutes}
                                      onChange={e => setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          rows: anchorSelections[prompt.id].rows.map(r => r.id === row.id ? { ...r, startMinutes: parseInt(e.target.value) } : r),
                                        },
                                      })}
                                      className="w-full px-2 py-1 border rounded bg-input"
                                    >
                                      {timeOptions.map(m => (
                                        <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-muted-foreground mb-1">Duration (min)</label>
                                    <input
                                      type="number"
                                      min={15}
                                      step={15}
                                      value={row.durationMinutes}
                                      onChange={e => setAnchorSelections({
                                        ...anchorSelections,
                                        [prompt.id]: {
                                          ...anchorSelections[prompt.id],
                                          rows: anchorSelections[prompt.id].rows.map(r => r.id === row.id ? { ...r, durationMinutes: parseInt(e.target.value) || 60 } : r),
                                        },
                                      })}
                                      className="w-full px-2 py-1 border rounded bg-input"
                                    />
                                  </div>
                                  <div className="text-muted-foreground">
                                    {placement ? `Week ${placement.week}, ${placement.day.slice(0, 3)}` : 'Select a date'}
                                    {showWarning && (
                                      <p className="text-amber-500">Outside active class days</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setAnchorSelections({
                              ...anchorSelections,
                              [prompt.id]: {
                                ...anchorSelections[prompt.id],
                                rows: [
                                  ...anchorSelections[prompt.id].rows,
                                  {
                                    id: uuidv4(),
                                    date: formData.startDate || '',
                                    startMinutes: formData.dayStartMinutes,
                                    durationMinutes: prompt.defaultDurationMinutes ?? 60,
                                    createNow: true,
                                  },
                                ],
                              },
                            })}
                            className="text-xs text-accent underline"
                          >
                            Add another date
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {createPlanError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {createPlanError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="cancel-create-plan"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 glow-primary disabled:opacity-50 transition-all"
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
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">
              Analyzing image with OCR... {ocrProgress}%
            </p>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        </Modal>
      )}

      {ocrDrafts.length > 0 && !ocrProcessing && (
        <Modal
          open={true}
          onClose={() => { setOCRDrafts([]); setOCRPlanName(''); setOCRRawText(''); setOcrConfirmError(null); }}
          title="Screenshot Import Results"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1">OCR Has Limitations</p>
              <p className="text-amber-700">
                Screenshot scanning is unreliable. You must confirm the title and time for each event before scheduling.
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
            
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>{ocrDrafts.length} items detected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setOCRDrafts(prev => prev.map(d => isDraftValid(d) ? { ...d, confirmed: true } : d))}
                  className="text-blue-600 hover:underline"
                >
                  Confirm all valid
                </button>
                <button
                  onClick={() => setOCRDrafts(prev => prev.map(d => ({ ...d, confirmed: false })))}
                  className="text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-auto border rounded text-xs">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Confirm</th>
                    <th className="p-2 text-left">Day</th>
                    <th className="p-2 text-left">Start</th>
                    <th className="p-2 text-left">End</th>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ocrDrafts.map(draft => {
                    const valid = isDraftValid(draft);
                    const status = !draft.titleInput.trim()
                      ? 'Needs title'
                      : !draft.dayInput
                        ? 'Needs day'
                        : draft.startMinutesInput === null || draft.endMinutesInput === null || draft.endMinutesInput <= draft.startMinutesInput
                          ? 'Needs time'
                          : draft.confirmed ? 'Confirmed' : 'Ready';
                    return (
                      <tr key={draft.id} className={valid ? '' : 'bg-red-50 text-gray-500'}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={draft.confirmed}
                            disabled={!valid}
                            onChange={(e) => updateOcrDraft(draft.id, { confirmed: e.target.checked })}
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={draft.dayInput || ''}
                            onChange={(e) => updateOcrDraft(draft.id, { dayInput: e.target.value as Day })}
                            className="border rounded px-1 py-0.5"
                          >
                            <option value="">Day...</option>
                            {DAYS.map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={draft.startMinutesInput ?? ''}
                            onChange={(e) => {
                              const nextStart = e.target.value ? parseInt(e.target.value, 10) : null;
                              let nextEnd = draft.endMinutesInput;
                              if (nextStart !== null && (nextEnd === null || nextEnd <= nextStart)) {
                                const candidate = nextStart + 60;
                                nextEnd = candidate <= 930 ? candidate : nextStart + 15;
                              }
                              updateOcrDraft(draft.id, { startMinutesInput: nextStart, endMinutesInput: nextEnd });
                            }}
                            className="border rounded px-1 py-0.5"
                          >
                            <option value="">Start...</option>
                            {timeOptions.slice(0, -1).map(m => (
                              <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={draft.endMinutesInput ?? ''}
                            onChange={(e) => {
                              const nextEnd = e.target.value ? parseInt(e.target.value, 10) : null;
                              updateOcrDraft(draft.id, { endMinutesInput: nextEnd });
                            }}
                            className="border rounded px-1 py-0.5"
                          >
                            <option value="">End...</option>
                            {timeOptions.slice(1).map(m => (
                              <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            value={draft.titleInput}
                            onChange={(e) => updateOcrDraft(draft.id, { titleInput: e.target.value })}
                            className="border rounded px-1 py-0.5 w-full"
                          />
                        </td>
                        <td className="p-2">{status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Show raw scanned text</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-24 whitespace-pre-wrap text-[10px]">
                {ocrRawText || 'No text detected'}
              </pre>
            </details>

            {ocrConfirmError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{ocrConfirmError}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setOCRDrafts([]); setOCRPlanName(''); setOCRRawText(''); setOcrConfirmError(null); }}
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
                Create Plan from Confirmed Events
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Only confirmed events will be scheduled. Unconfirmed items stay in this review list.
            </p>
          </div>
        </Modal>
      )}

      {csvDrafts.length > 0 && (
        <Modal open={true} onClose={cancelCSVImport} title="Review CSV Import">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={csvPlanName}
                onChange={e => setCsvPlanName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Imported Schedule"
                data-testid="csv-plan-name-input"
              />
            </div>

            <p className="text-sm text-gray-600">
              {csvDrafts.length} events detected. Review and click Create Plan to import.
            </p>

            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lockCsvEvents}
                onChange={e => setLockCsvEvents(e.target.checked)}
              />
              <span>Lock imported events (prevents drag/resize until unlocked)</span>
            </div>
            
            <div className="max-h-64 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Week</th>
                    <th className="p-2 text-left">Day</th>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {csvDrafts.map(draft => (
                    <tr key={draft.id} className={draft.needsReview ? 'bg-yellow-50' : ''}>
                      <td className="p-2">{draft.week}</td>
                      <td className="p-2">{draft.day}</td>
                      <td className="p-2">{minutesToTimeDisplay(draft.startMinutes)} - {minutesToTimeDisplay(draft.startMinutes + draft.durationMinutes)}</td>
                      <td className="p-2 truncate max-w-[150px]">{draft.title}</td>
                      <td className="p-2">
                        {draft.needsReview ? (
                          <span className="text-yellow-700">{draft.warning}</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {importError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{importError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={cancelCSVImport}
                className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyCSVDrafts}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                data-testid="apply-csv-import"
              >
                Create Plan
              </button>
            </div>
          </div>
        </Modal>
      )}

      {csvContent && csvDrafts.length === 0 && (
        <Modal open={true} onClose={cancelCSVImport} title="Map CSV Columns">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plan Name *</label>
              <input
                type="text"
                value={csvPlanName}
                onChange={e => setCsvPlanName(e.target.value)}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Imported Schedule"
              />
            </div>

            <p className="text-sm text-gray-600">
              Map your CSV columns to the schedule fields:
            </p>

            <div className="border rounded p-3 space-y-2 text-sm">
              <p className="text-xs text-gray-500">Saved column mappings</p>
              <div className="flex gap-2 items-center">
                <select
                  value={selectedCsvPreset}
                  onChange={(e) => handleSelectCsvPreset(e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-xs"
                >
                  <option value="">Select saved mapping...</option>
                  {csvPresets.map(preset => (
                    <option key={preset.name} value={preset.name}>{preset.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteCsvPreset}
                  disabled={!selectedCsvPreset}
                  className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  value={csvPresetName}
                  onChange={(e) => setCsvPresetName(e.target.value)}
                  placeholder="Save as..."
                  className="flex-1 px-2 py-1 border rounded text-xs"
                />
                <button
                  onClick={handleSaveCsvPreset}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                >
                  Save
                </button>
              </div>
              {csvPresetNotice && (
                <p className="text-xs text-gray-500">{csvPresetNotice}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {(['week', 'day', 'startTime', 'endTime', 'title', 'location', 'notes'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                    {field === 'title' && ' *'}
                  </label>
                  <select
                    value={csvMapping[field]}
                    onChange={e => setCSVMapping({ ...csvMapping, [field]: parseInt(e.target.value, 10) })}
                    className="w-full px-2 py-1 border rounded text-xs"
                  >
                    {field === 'location' || field === 'notes' ? (
                      <option value={-1}>-- Not mapped --</option>
                    ) : null}
                    {csvHeaders.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={lockCsvEvents}
                onChange={e => setLockCsvEvents(e.target.checked)}
              />
              <span>Lock imported events (prevents drag/resize until unlocked)</span>
            </div>

            {importError && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{importError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={cancelCSVImport}
                className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCSVPreview}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                data-testid="preview-csv-button"
              >
                Preview Import
              </button>
            </div>
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

            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={lockIcsEvents}
                  onChange={e => setLockIcsEvents(e.target.checked)}
                  className="rounded"
                  data-testid="ics-lock-events"
                />
                Lock imported events (prevents drag/resize until unlocked)
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
                    {filteredICSEvents.slice(0, 50).map((event, idx) => {
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
                          key={`${event.uid}-${idx}`} 
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
