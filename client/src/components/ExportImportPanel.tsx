import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '@/state/store';
import { Plan, AppState, PlacedBlock, DAYS, Day } from '@/state/types';
import { exportToCSV, exportToICS, downloadCSV, downloadJSON, downloadICS, importICSToBlocks, importCSVToBlocks, getCSVHeaders, CSVDraftEvent, parseICSWithDateRange, convertICSEventsToBlocks } from '@/lib/csv';
import { validateAppState } from '@/state/validators';
import { Modal } from './Modal';
import { minutesToTimeDisplay } from '@/lib/time';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { loadTitleAliases, importAliasCSV, exportAliasCSV, TitleAlias } from '@/lib/titleAliases';
import { loadResources, importResourceCSV, exportResourceCSV } from '@/lib/resources';
import { loadHardEvents, importHardEventsCSV, exportHardEventsCSV } from '@/lib/hardEvents';
import { resolveTemplateForImportedTitle } from '@/lib/templateMatcher';
import { buildTrainingDataFromBlocks } from '@/lib/trainingData';

interface ExportImportPanelProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}

type OCRDraft = OCREvent & {
  confirmed: boolean;
  titleInput: string;
  dayInput: Day | null;
  startMinutesInput: number | null;
  endMinutesInput: number | null;
};

export function ExportImportPanel({ plan, open, onClose }: ExportImportPanelProps) {
  const { state, dispatch } = useStore();
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  
  const [csvContent, setCSVContent] = useState<string | null>(null);
  const [csvHeaders, setCSVHeaders] = useState<string[]>([]);
  const [csvMapping, setCSVMapping] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('csvMapping');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch {}
    }
    return {
      week: 1,
      day: 2,
      startTime: 3,
      endTime: 4,
      title: 5,
      location: 8,
      notes: 9,
    };
  });
  const [csvDrafts, setCSVDrafts] = useState<CSVDraftEvent[]>([]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('csvMapping', JSON.stringify(csvMapping));
      } catch {}
    }
  }, [csvMapping]);

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

  const isDraftValid = (draft: OCRDraft): boolean => {
    if (!draft.titleInput.trim()) return false;
    if (!draft.dayInput) return false;
    if (draft.startMinutesInput === null || draft.endMinutesInput === null) return false;
    return draft.endMinutesInput > draft.startMinutesInput;
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
  
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [ocrProcessing, setOCRProcessing] = useState(false);
  const [ocrProgress, setOCRProgress] = useState(0);
  const [ocrDrafts, setOCRDrafts] = useState<OCRDraft[]>([]);
  const [ocrRawText, setOCRRawText] = useState('');
  const [ocrConfirmError, setOcrConfirmError] = useState<string | null>(null);

  const [icsPreview, setIcsPreview] = useState<null | {
    events: any[];
    minDateStr: string;
    maxDateStr: string;
    minDate: Date | null;
    maxDate: Date | null;
    detectedTimezone: string | null;
    raw: string;
  }>(null);
  const [icsRangeStart, setIcsRangeStart] = useState<string | null>(null);
  const [icsRangeEnd, setIcsRangeEnd] = useState<string | null>(null);
  const [lockIcsEvents, setLockIcsEvents] = useState(true);
  const [lockCsvEvents, setLockCsvEvents] = useState(true);
  
  const aliasInputRef = useRef<HTMLInputElement>(null);
  const resourceInputRef = useRef<HTMLInputElement>(null);
  const hardEventsInputRef = useRef<HTMLInputElement>(null);
  
  const [aliasCount, setAliasCount] = useState(() => loadTitleAliases().aliases.length);
  const [resourceCount, setResourceCount] = useState(() => loadResources().resources.length);
  const [hardEventCount, setHardEventCount] = useState(() => loadHardEvents().events.length);
  const [configImportSuccess, setConfigImportSuccess] = useState<string | null>(null);
  
  const handleAliasCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const count = importAliasCSV(content);
      if (count > 0) {
        setAliasCount(loadTitleAliases().aliases.length);
        setConfigImportSuccess(`Imported ${count} title aliases`);
        setTimeout(() => setConfigImportSuccess(null), 3000);
      } else {
        setImportError('No valid aliases found. Make sure CSV has raw_title,template_id columns.');
      }
    };
    reader.readAsText(file);
    if (aliasInputRef.current) aliasInputRef.current.value = '';
  };
  
  const handleAliasCSVExport = () => {
    const csv = exportAliasCSV();
    downloadCSVFile(csv, 'title_aliases.csv');
  };
  
  const handleResourceCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const count = importResourceCSV(content);
      if (count > 0) {
        setResourceCount(loadResources().resources.length);
        setConfigImportSuccess(`Imported ${count} resources`);
        setTimeout(() => setConfigImportSuccess(null), 3000);
      } else {
        setImportError('No valid resources found. Make sure CSV has resource_id,name columns.');
      }
    };
    reader.readAsText(file);
    if (resourceInputRef.current) resourceInputRef.current.value = '';
  };
  
  const handleResourceCSVExport = () => {
    const csv = exportResourceCSV();
    downloadCSVFile(csv, 'resources.csv');
  };
  
  const handleHardEventsCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const count = importHardEventsCSV(content);
      if (count > 0) {
        setHardEventCount(loadHardEvents().events.length);
        setConfigImportSuccess(`Imported ${count} locked events`);
        setTimeout(() => setConfigImportSuccess(null), 3000);
      } else {
        setImportError('No valid events found. Check CSV format.');
      }
    };
    reader.readAsText(file);
    if (hardEventsInputRef.current) hardEventsInputRef.current.value = '';
  };
  
  const handleHardEventsCSVExport = () => {
    const csv = exportHardEventsCSV();
    downloadCSVFile(csv, 'hard_events.csv');
  };
  
  const downloadCSVFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csv = exportToCSV(plan, state.templates);
    const filename = `${plan.settings.name.replace(/\s+/g, '_')}_schedule.csv`;
    downloadCSV(csv, filename);
  };

  const handleExportICS = () => {
    const ics = exportToICS(plan, state.templates);
    const filename = `${plan.settings.name.replace(/\s+/g, '_')}_calendar.ics`;
    downloadICS(ics, filename);
  };

  const handleExportJSON = () => {
    const exportData: AppState = {
      version: 2,
      templates: state.templates,
      plans: [plan],
      partners: state.partners,
    };
    const filename = `${plan.settings.name.replace(/\s+/g, '_')}_backup.json`;
    downloadJSON(exportData, filename);
  };

  const handleExportAllJSON = () => {
    const filename = `schedule_builder_full_backup.json`;
    downloadJSON(state, filename);
  };

  const handleImportFile = (file: File) => {
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
          payload: { state: parsed as AppState, mode: importMode },
        });
        
        setImportError(null);
        onClose();
      } catch (err) {
        setImportError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImportFile(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportICSFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseICSWithDateRange(content);
        if (!parsed || !parsed.events || parsed.events.length === 0) {
          setImportError('No events found in ICS file.');
          setImportSuccess(null);
          return;
        }

        setIcsPreview({
          events: parsed.events,
          minDateStr: parsed.minDateStr,
          maxDateStr: parsed.maxDateStr,
          minDate: parsed.minDate,
          maxDate: parsed.maxDate,
          detectedTimezone: parsed.detectedTimezone,
          raw: content,
        });
        setIcsRangeStart(parsed.minDateStr);
        setIcsRangeEnd(parsed.maxDateStr);
        setImportError(null);
        setImportSuccess(null);
      } catch (err) {
        setImportError('Failed to parse ICS file');
        setImportSuccess(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImportICS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImportICSFile(file);
    
    if (icsInputRef.current) {
      icsInputRef.current.value = '';
    }
  };

  const handleApplyICSPreview = () => {
    if (!icsPreview || !icsRangeStart || !icsRangeEnd) return;
    const startDate = new Date(icsRangeStart + 'T00:00:00');
    const endDate = new Date(icsRangeEnd + 'T23:59:59');
    const { blocks, skipped, included } = convertICSEventsToBlocks(icsPreview.events, state.templates, startDate, endDate, false);

    if (!blocks || blocks.length === 0) {
      setImportError('No valid blocks in selected date range.');
      setIcsPreview(null);
      return;
    }

    const importedBlocks = blocks.map(block => ({
      ...block,
      isLocked: lockIcsEvents,
      isAfterHours: false,
    }));

    for (const block of importedBlocks) {
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
    }

    const trainingData = buildTrainingDataFromBlocks(importedBlocks, 'import:ics');
    dispatch({
      type: 'ADD_TRAINING_DATA',
      payload: { planId: plan.id, examples: trainingData.examples, unmatched: trainingData.unmatched },
    });

    setImportSuccess(`Imported ${included} events${skipped > 0 ? ` (${skipped} skipped)` : ''}.`);
    setIcsPreview(null);
  };

  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCSVContent(content);
      const headers = getCSVHeaders(content);
      setCSVHeaders(headers);
      
      const autoMapping = { ...csvMapping };
      headers.forEach((h, i) => {
        const lowerH = h.toLowerCase();
        if (lowerH.includes('week')) autoMapping.week = i;
        else if (lowerH.includes('day')) autoMapping.day = i;
        else if (lowerH.includes('start')) autoMapping.startTime = i;
        else if (lowerH.includes('end')) autoMapping.endTime = i;
        else if (lowerH.includes('title') || lowerH.includes('name') || lowerH.includes('event')) autoMapping.title = i;
        else if (lowerH.includes('location') || lowerH.includes('room')) autoMapping.location = i;
        else if (lowerH.includes('note') || lowerH.includes('description')) autoMapping.notes = i;
      });
      setCSVMapping(autoMapping);
    };
    reader.readAsText(file);
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleCSVFile(file);
    
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  const handleCSVPreview = () => {
    if (!csvContent) return;
    const { drafts, errors } = importCSVToBlocks(csvContent, csvMapping);
    if (errors.length > 0) {
      setImportError(errors.join('; '));
      return;
    }
    setCSVDrafts(drafts);
    setImportError(null);
  };

  const handleApplyCSVDrafts = () => {
    let imported = 0;
    let unassigned = 0;
    const importedBlocks: PlacedBlock[] = [];
    
    for (const draft of csvDrafts) {
      const matchContext = [draft.notes, draft.location].filter(Boolean).join(' ');
      const match = resolveTemplateForImportedTitle(draft.title, state.templates, matchContext);
      const matchedTemplate = match.templateId ? state.templates.find(t => t.id === match.templateId) : null;

      const block: PlacedBlock = {
        id: uuidv4(),
        templateId: match.templateId,
        week: draft.week,
        day: draft.day,
        startMinutes: draft.startMinutes,
        durationMinutes: draft.durationMinutes,
        titleOverride: draft.title,
        location: draft.location,
        notes: draft.notes,
        countsTowardGoldenRule: matchedTemplate ? matchedTemplate.countsTowardGoldenRule : false,
        goldenRuleBucketId: matchedTemplate ? matchedTemplate.goldenRuleBucketId : null,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
        isLocked: lockCsvEvents,
        isAfterHours: false,
      };

      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
      importedBlocks.push(block);
      imported++;
      if (!match.templateId) unassigned++;
    }

    const trainingData = buildTrainingDataFromBlocks(importedBlocks, 'import:csv');
    dispatch({
      type: 'ADD_TRAINING_DATA',
      payload: { planId: plan.id, examples: trainingData.examples, unmatched: trainingData.unmatched },
    });
    
    setCSVDrafts([]);
    setCSVContent(null);
    const msg = unassigned > 0 
      ? `Imported ${imported} events (${unassigned} unassigned - double-click to assign).`
      : `Imported ${imported} events from CSV.`;
    setImportSuccess(msg);
  };

  const cancelCSVImport = () => {
    setCSVContent(null);
    setCSVHeaders([]);
    setCSVDrafts([]);
  };

  const handleOCRFile = async (file: File) => {
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
      
      if (events.length === 0) {
        setImportError('No schedule events detected in the image. Try a clearer image with visible times.');
        setOCRDrafts([]);
      }
    } catch (err) {
      setImportError('Failed to process image. Please try again.');
    } finally {
      setOCRProcessing(false);
    }
  };

  const handleOCRFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleOCRFile(file);

    if (ocrInputRef.current) {
      ocrInputRef.current.value = '';
    }
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
      handleImportICSFile(file);
    } else if (fileName.endsWith('.csv') || fileType === 'text/csv') {
      handleCSVFile(file);
    } else if (fileName.endsWith('.json') || fileType === 'application/json') {
      handleImportFile(file);
    } else if (fileType.startsWith('image/')) {
      await handleOCRFile(file);
    } else {
      setImportError('Unsupported file type. Drag an ICS, CSV, JSON, or image file.');
    }
  };

  const wrapWithDropZone = (content: React.ReactNode) => (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative">
      {isDragging && (
        <div className="fixed inset-0 bg-purple-500/20 border-4 border-dashed border-purple-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="glass-card rounded-lg p-6 shadow-lg text-center">
            <p className="text-lg font-medium text-foreground">Drop your file here</p>
            <p className="text-sm text-muted-foreground">ICS, CSV, JSON, or image files</p>
          </div>
        </div>
      )}
      {content}
    </div>
  );

  const handleApplyOCREvents = () => {
    let imported = 0;
    let unassigned = 0;
    
    const confirmedDrafts = ocrDrafts.filter(draft => draft.confirmed && isDraftValid(draft));
    if (confirmedDrafts.length === 0) {
      setOcrConfirmError('Confirm at least one event with a valid title, day, start time, and end time.');
      return;
    }

    for (const draft of confirmedDrafts) {
      const startMinutes = draft.startMinutesInput!;
      const endMinutes = draft.endMinutesInput!;
      let durationMinutes = endMinutes - startMinutes;
      durationMinutes = Math.max(15, Math.ceil(durationMinutes / 15) * 15);
      
      const match = resolveTemplateForImportedTitle(draft.titleInput, state.templates);
      const matchedTemplate = match.templateId ? state.templates.find(t => t.id === match.templateId) : null;

      const block: PlacedBlock = {
        id: uuidv4(),
        templateId: match.templateId,
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
      };
      
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
      imported++;
      if (!match.templateId) unassigned++;
    }
    
    setOCRDrafts([]);
    setOCRRawText('');
    setOcrConfirmError(null);
    const msg = unassigned > 0 
      ? `Imported ${imported} events (${unassigned} unassigned - double-click to assign).`
      : `Imported ${imported} events from image.`;
    setImportSuccess(msg);
  };

  const cancelOCRImport = () => {
    setOCRDrafts([]);
    setOCRRawText('');
    setOcrConfirmError(null);
  };

  if (ocrDrafts.length > 0) {
    return wrapWithDropZone(
      <Modal open={open} onClose={onClose} title="Review OCR Import">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <p className="font-medium text-amber-800 mb-1">OCR Has Limitations</p>
            <p className="text-amber-700">
              Screenshot scanning is unreliable. Confirm the title and time for each event before scheduling.
            </p>
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
          
          <div className="max-h-64 overflow-auto border rounded">
            <table className="w-full text-xs">
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
            <summary className="cursor-pointer text-gray-500">Show raw OCR text</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32 whitespace-pre-wrap">
              {ocrRawText}
            </pre>
          </details>

          {ocrConfirmError && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{ocrConfirmError}</p>
          )}
          
          <div className="flex gap-3">
            <button
              onClick={cancelOCRImport}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyOCREvents}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="apply-ocr-import"
            >
              Apply Confirmed Events
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (icsPreview) {
    return wrapWithDropZone(
      <Modal open={open} onClose={() => { setIcsPreview(null); onClose(); }} title="Preview ICS Import">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Detected events from {icsPreview.minDateStr} to {icsPreview.maxDateStr}. Select a date range to include before importing.</p>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500">Start Date</label>
              <input type="date" value={icsRangeStart || ''} onChange={(e) => setIcsRangeStart(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">End Date</label>
              <input type="date" value={icsRangeEnd || ''} onChange={(e) => setIcsRangeEnd(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lockIcsEvents}
              onChange={(e) => setLockIcsEvents(e.target.checked)}
            />
            <span>Lock imported events (prevents drag/resize until unlocked)</span>
          </div>

          <div className="max-h-64 overflow-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Match</th>
                </tr>
              </thead>
              <tbody>
                {icsPreview.events.map((ev: any, idx: number) => {
                  const matchContext = [ev.description, ev.location].filter(Boolean).join(' ');
                  const match = resolveTemplateForImportedTitle(ev.summary, state.templates, matchContext);
                  const matchedTemplate = match.templateId ? state.templates.find(t => t.id === match.templateId) : null;
                  return (
                    <tr key={idx} className={match.templateId ? '' : 'bg-yellow-50'}>
                      <td className="p-2">{ev.localDateStr || ev.dtstart?.toISOString?.().slice(0,10) || ''}</td>
                      <td className="p-2">{ev.dtstart ? `${new Date(ev.dtstart).getHours()}:${String(new Date(ev.dtstart).getMinutes()).padStart(2,'0')}` : ''} - {ev.dtend ? `${new Date(ev.dtend).getHours()}:${String(new Date(ev.dtend).getMinutes()).padStart(2,'0')}` : ''}</td>
                      <td className="p-2 truncate max-w-[250px]">{ev.summary}</td>
                      <td className="p-2 text-xs">
                        {match.templateId ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{matchedTemplate?.title}</span>
                            <span className="text-gray-500">{Math.round(match.confidence * 100)}%</span>
                          </div>
                        ) : (
                          <span className="text-orange-600 font-medium">UNASSIGNED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setIcsPreview(null); }} className="flex-1 px-4 py-2 border rounded">Cancel</button>
            <button onClick={handleApplyICSPreview} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">Import Selected Range</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (ocrProcessing) {
    return wrapWithDropZone(
      <Modal open={open} onClose={() => {}} title="Processing Image...">
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
    );
  }

  if (csvDrafts.length > 0) {
    return wrapWithDropZone(
      <Modal open={open} onClose={onClose} title="Review CSV Import">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {csvDrafts.length} events detected. Review and click Apply to import.
          </p>

          <div className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lockCsvEvents}
              onChange={(e) => setLockCsvEvents(e.target.checked)}
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
                        <span className="flex items-center gap-1 text-yellow-600">
                          <AlertTriangle className="w-3 h-3" />
                          {draft.warning}
                        </span>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
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
              Apply {csvDrafts.length} Events
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (csvContent) {
    return wrapWithDropZone(
      <Modal open={open} onClose={onClose} title="Map CSV Columns">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Map your CSV columns to the schedule fields:
          </p>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(['week', 'day', 'startTime', 'endTime', 'title', 'location', 'notes'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium mb-1 capitalize">
                  {field.replace(/([A-Z])/g, ' $1').trim()}
                  {field === 'title' && ' *'}
                </label>
                <select
                  value={csvMapping[field]}
                  onChange={e => setCSVMapping({ ...csvMapping, [field]: parseInt(e.target.value) })}
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
    );
  }

  return wrapWithDropZone(
    <Modal open={open} onClose={onClose} title="Export / Import">
      <div className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Export Current Plan</h4>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportCSV}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="export-csv-button"
            >
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="export-json-button"
            >
              JSON
            </button>
            <button
              onClick={handleExportICS}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="export-ics-button"
            >
              ICS (Calendar)
            </button>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-3">Export All Data</h4>
          <button
            onClick={handleExportAllJSON}
            className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50"
            data-testid="export-all-json-button"
          >
            Export Full Backup (All Plans + Templates)
          </button>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Configuration Files</h4>
          <p className="text-sm text-gray-600 mb-3">
            Upload CSV files to configure title mappings, resources, and locked events.
          </p>
          
          <input ref={aliasInputRef} type="file" accept=".csv" onChange={handleAliasCSVUpload} className="hidden" data-testid="alias-csv-input" />
          <input ref={resourceInputRef} type="file" accept=".csv" onChange={handleResourceCSVUpload} className="hidden" data-testid="resource-csv-input" />
          <input ref={hardEventsInputRef} type="file" accept=".csv" onChange={handleHardEventsCSVUpload} className="hidden" data-testid="hardevents-csv-input" />
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm w-40">Title Aliases ({aliasCount})</span>
              <button onClick={() => aliasInputRef.current?.click()} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="import-alias-button">
                Upload
              </button>
              <button onClick={handleAliasCSVExport} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="export-alias-button">
                Export
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm w-40">Resources ({resourceCount})</span>
              <button onClick={() => resourceInputRef.current?.click()} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="import-resource-button">
                Upload
              </button>
              <button onClick={handleResourceCSVExport} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="export-resource-button">
                Export
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm w-40">Locked Events ({hardEventCount})</span>
              <button onClick={() => hardEventsInputRef.current?.click()} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="import-hardevents-button">
                Upload
              </button>
              <button onClick={handleHardEventsCSVExport} className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50" data-testid="export-hardevents-button">
                Export
              </button>
            </div>
          </div>
          
          {configImportSuccess && (
            <p className="mt-2 text-sm text-green-600">{configImportSuccess}</p>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Import Data</h4>
          
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
                data-testid="import-mode-merge"
              />
              Merge with existing data
            </label>
            <label className="flex items-center gap-2 text-sm mt-1">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                data-testid="import-mode-replace"
              />
              Replace all data
            </label>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            data-testid="import-file-input"
          />
          
          <input
            ref={icsInputRef}
            type="file"
            accept=".ics,.ical"
            onChange={handleImportICS}
            className="hidden"
            data-testid="import-ics-input"
          />
          
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVFileSelect}
            className="hidden"
            data-testid="import-csv-input"
          />
          
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/*"
            onChange={handleOCRFileSelect}
            className="hidden"
            data-testid="import-ocr-input"
          />
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="import-button"
            >
              Import JSON
            </button>
            <button
              onClick={() => icsInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="import-ics-button"
            >
              Import ICS
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="import-csv-button"
            >
              Import CSV
            </button>
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="flex-1 px-4 py-2 text-sm border rounded hover:bg-gray-50 flex items-center justify-center gap-1"
              data-testid="import-ocr-button"
            >
              <Camera className="w-4 h-4" />
              Import Image (OCR)
            </button>
          </div>

          {importError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded" data-testid="import-error">
              {importError}
            </p>
          )}
          
          {importSuccess && (
            <p className="mt-3 text-sm text-green-600 bg-green-50 p-3 rounded" data-testid="import-success">
              {importSuccess}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
