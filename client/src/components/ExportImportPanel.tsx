import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/state/store';
import { Plan, AppState, PlacedBlock, DAYS, Day } from '@/state/types';
import { exportToCSV, exportToICS, downloadCSV, downloadJSON, downloadICS, importICSToBlocks, importCSVToBlocks, getCSVHeaders, CSVDraftEvent } from '@/lib/csv';
import { validateAppState } from '@/state/validators';
import { Modal } from './Modal';
import { minutesToTimeDisplay } from '@/lib/time';
import { v4 as uuidv4 } from 'uuid';
import { AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { loadTitleAliases, importAliasCSV, exportAliasCSV, TitleAlias } from '@/lib/titleAliases';
import { loadResources, importResourceCSV, exportResourceCSV } from '@/lib/resources';
import { loadHardEvents, importHardEventsCSV, exportHardEventsCSV } from '@/lib/hardEvents';

interface ExportImportPanelProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}

export function ExportImportPanel({ plan, open, onClose }: ExportImportPanelProps) {
  const { state, dispatch } = useStore();
  const [importError, setImportError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
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
  
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [ocrProcessing, setOCRProcessing] = useState(false);
  const [ocrProgress, setOCRProgress] = useState(0);
  const [ocrEvents, setOCREvents] = useState<OCREvent[]>([]);
  const [ocrRawText, setOCRRawText] = useState('');
  
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          payload: { state: parsed as AppState, mode: importMode },
        });
        
        setImportError(null);
        onClose();
      } catch (err) {
        setImportError('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportICS = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { blocks, skipped } = importICSToBlocks(content, state.templates);
        
        if (blocks.length === 0) {
          setImportError('No valid events found in ICS file. Events must be Mon-Fri, 6:30 AM - 3:30 PM.');
          setImportSuccess(null);
          return;
        }

        for (const block of blocks) {
          dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
        }
        
        setImportError(null);
        setImportSuccess(`Imported ${blocks.length} events${skipped > 0 ? ` (${skipped} skipped - outside schedule hours or weekend)` : ''}.`);
      } catch (err) {
        setImportError('Failed to parse ICS file');
        setImportSuccess(null);
      }
    };
    reader.readAsText(file);
    
    if (icsInputRef.current) {
      icsInputRef.current.value = '';
    }
  };

  const handleCSVFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    const defaultTemplate = state.templates[0];
    if (!defaultTemplate) {
      setImportError('No templates available. Create a template first.');
      return;
    }

    let imported = 0;
    for (const draft of csvDrafts) {
      const matchingTemplate = state.templates.find(t => 
        t.title.toLowerCase() === draft.title.toLowerCase()
      ) || defaultTemplate;
      
      const block: PlacedBlock = {
        id: uuidv4(),
        templateId: matchingTemplate.id,
        week: draft.week,
        day: draft.day,
        startMinutes: draft.startMinutes,
        durationMinutes: draft.durationMinutes,
        titleOverride: matchingTemplate.title === draft.title ? '' : draft.title,
        location: draft.location,
        notes: draft.notes,
        countsTowardGoldenRule: matchingTemplate.countsTowardGoldenRule,
        goldenRuleBucketId: matchingTemplate.goldenRuleBucketId,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
      };
      
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
      imported++;
    }
    
    setCSVDrafts([]);
    setCSVContent(null);
    setImportSuccess(`Imported ${imported} events from CSV.`);
  };

  const cancelCSVImport = () => {
    setCSVContent(null);
    setCSVHeaders([]);
    setCSVDrafts([]);
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
      
      if (events.length === 0) {
        setImportError('No schedule events detected in the image. Try a clearer image with visible times.');
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

  const handleApplyOCREvents = () => {
    const defaultTemplate = state.templates[0];
    if (!defaultTemplate) {
      setImportError('No templates available. Create a template first.');
      return;
    }

    let imported = 0;
    for (const event of ocrEvents) {
      if (event.startMinutes === null || event.endMinutes === null || !event.day) continue;
      
      const startMinutes = Math.max(390, Math.min(event.startMinutes, 915));
      let durationMinutes = event.endMinutes - event.startMinutes;
      durationMinutes = Math.max(15, Math.ceil(durationMinutes / 15) * 15);
      
      if (startMinutes + durationMinutes > 930) {
        durationMinutes = 930 - startMinutes;
      }
      
      const matchingTemplate = state.templates.find(t => 
        t.title.toLowerCase() === event.title.toLowerCase()
      ) || defaultTemplate;
      
      const block: PlacedBlock = {
        id: uuidv4(),
        templateId: matchingTemplate.id,
        week: 1,
        day: event.day,
        startMinutes,
        durationMinutes,
        titleOverride: matchingTemplate.title === event.title ? '' : event.title,
        location: '',
        notes: `Imported via OCR: ${event.rawText}`,
        countsTowardGoldenRule: matchingTemplate.countsTowardGoldenRule,
        goldenRuleBucketId: matchingTemplate.goldenRuleBucketId,
        recurrenceSeriesId: null,
        isRecurrenceException: false,
      };
      
      dispatch({ type: 'ADD_BLOCK', payload: { planId: plan.id, block } });
      imported++;
    }
    
    setOCREvents([]);
    setOCRRawText('');
    setImportSuccess(`Imported ${imported} events from image.`);
  };

  const cancelOCRImport = () => {
    setOCREvents([]);
    setOCRRawText('');
  };

  if (ocrEvents.length > 0) {
    return (
      <Modal open={open} onClose={onClose} title="Review OCR Import">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {ocrEvents.length} events detected. Events with missing data will be skipped.
          </p>
          
          <div className="max-h-64 overflow-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {ocrEvents.map(event => {
                  const isValid = event.startMinutes !== null && event.endMinutes !== null && event.day !== null;
                  return (
                    <tr key={event.id} className={isValid ? '' : 'bg-red-50 text-gray-400'}>
                      <td className="p-2">{event.day || '?'}</td>
                      <td className="p-2">{event.startTime} - {event.endTime}</td>
                      <td className="p-2 truncate max-w-[150px]">{event.title}</td>
                      <td className="p-2">{Math.round(event.confidence * 100)}%</td>
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
              Apply Valid Events
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (ocrProcessing) {
    return (
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
    return (
      <Modal open={open} onClose={onClose} title="Review CSV Import">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {csvDrafts.length} events detected. Review and click Apply to import.
          </p>
          
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
    return (
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

  return (
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
