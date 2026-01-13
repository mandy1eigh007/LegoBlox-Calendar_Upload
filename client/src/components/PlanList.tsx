import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES, AppState, PlacedBlock, Day, DAYS } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { createDefaultPlanSettings } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { validateAppState } from '@/state/validators';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { Camera, Upload, Loader2, FileUp } from 'lucide-react';
import { parseICSWithDateRange, convertICSEventsToBlocks, ICSEventWithDate } from '@/lib/csv';

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
    
    const defaultTemplate = state.templates[0];
    if (!defaultTemplate) {
      setImportError('No templates available.');
      return;
    }

    const blocks: PlacedBlock[] = [];
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
      
      blocks.push({
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
        const { events, minDate, maxDate, minDateStr, maxDateStr } = parseICSWithDateRange(content);
        
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
        setIcsImportPlanName(`Imported from ${file.name.replace(/\.[^/.]+$/, '')}`);
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
    if (!icsImportPlanName.trim() || pendingICSEvents.length === 0 || !icsStartDate || !icsEndDate) return;
    
    const startDate = new Date(icsStartDate);
    const endDate = new Date(icsEndDate);
    
    const { blocks, included } = convertICSEventsToBlocks(
      pendingICSEvents,
      state.templates,
      startDate,
      endDate
    );
    
    if (blocks.length === 0) {
      setImportError('No valid events in selected date range. Events must be Mon-Fri, 6:30 AM - 3:30 PM.');
      return;
    }
    
    const plan: Plan = {
      id: uuidv4(),
      settings: { ...createDefaultPlanSettings(), name: icsImportPlanName },
      blocks,
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
  };
  
  const filteredICSEvents = pendingICSEvents.filter(e => {
    if (!icsStartDate || !icsEndDate) return true;
    return e.localDateStr >= icsStartDate && e.localDateStr <= icsEndDate;
  });

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
      className="min-h-screen bg-gray-50 p-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 border-4 border-dashed border-blue-500 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg p-8 shadow-lg text-center">
            <FileUp className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <p className="text-lg font-medium">Drop your file here</p>
            <p className="text-sm text-gray-500">ICS, JSON, or image files</p>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cohort Schedule Builder</h1>
          <div className="flex gap-2 flex-wrap">
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
            <button
              onClick={() => icsInputRef.current?.click()}
              className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
              data-testid="import-ics-button"
            >
              <Upload className="w-4 h-4" />
              Import ICS
            </button>
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
              data-testid="import-json-button"
            >
              <Upload className="w-4 h-4" />
              Import Backup
            </button>
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2 bg-white"
              data-testid="import-screenshot-button"
            >
              <Camera className="w-4 h-4" />
              Screenshot
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="create-plan-button"
            >
              Create New Plan
            </button>
          </div>
        </div>
        
        <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-white text-center">
          <FileUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Drag & drop ICS, JSON, or image files here</p>
          <p className="text-xs text-gray-400 mt-1">or use the buttons above</p>
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

        {state.plans.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <p className="text-gray-500 mb-4">No plans created yet</p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="create-first-plan-button"
            >
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {state.plans.map(plan => (
              <div
                key={plan.id}
                className="bg-white rounded-lg border p-4 flex items-center justify-between hover:border-blue-300 transition-colors"
                data-testid={`plan-card-${plan.id}`}
              >
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.settings.name}</h3>
                  <p className="text-sm text-gray-500">
                    {plan.settings.weeks} weeks | {plan.blocks.length} blocks
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/plan/${plan.id}`)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    data-testid={`open-plan-${plan.id}`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setDeleteId(plan.id)}
                    className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                    data-testid={`delete-plan-${plan.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
              <p className="font-medium text-amber-800 mb-1">Limited Results</p>
              <p className="text-amber-700">
                Screenshot scanning has difficulty with calendar grids. For better results, export your calendar as ICS file:
              </p>
              <div className="text-amber-600 text-xs mt-2 space-y-1">
                <p><strong>Google Calendar:</strong> Settings → Import & export → Export</p>
                <p><strong>Outlook Desktop:</strong> File → Save Calendar → Save as ICS</p>
                <p><strong>Outlook Web:</strong> Calendar → Share → Publish Calendar → Copy ICS link</p>
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
                {ocrEvents.length} text items detected (may need editing after import):
              </p>
              <div className="max-h-36 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Day</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Detected Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ocrEvents.map(event => (
                      <tr key={event.id}>
                        <td className="p-2">{event.day || 'Mon'}</td>
                        <td className="p-2">{event.startTime} - {event.endTime}</td>
                        <td className="p-2 truncate max-w-[120px]" title={event.title}>{event.title}</td>
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
                Create Plan Anyway
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pendingICSEvents.length > 0 && (
        <Modal open={true} onClose={clearICSImport} title="Import Calendar Events">
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
              <p className="text-green-800">
                Found {pendingICSEvents.length} events in the calendar file!
              </p>
              {icsMinDate && icsMaxDate && (
                <p className="text-green-600 text-xs mt-1">
                  Events span from {icsMinDate.toLocaleDateString()} to {icsMaxDate.toLocaleDateString()}
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
            
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Preview ({filteredICSEvents.length} events in selected range):
              </p>
              <div className="max-h-48 overflow-auto border rounded text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Time</th>
                      <th className="p-2 text-left">Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredICSEvents.slice(0, 20).map(event => {
                      const startHour = event.dtstart.getHours();
                      const startMin = event.dtstart.getMinutes();
                      const endHour = event.dtend.getHours();
                      const endMin = event.dtend.getMinutes();
                      return (
                        <tr key={event.uid}>
                          <td className="p-2">{event.dtstart.toLocaleDateString()}</td>
                          <td className="p-2">
                            {startHour % 12 || 12}:{startMin.toString().padStart(2, '0')} {startHour >= 12 ? 'PM' : 'AM'} - 
                            {endHour % 12 || 12}:{endMin.toString().padStart(2, '0')} {endHour >= 12 ? 'PM' : 'AM'}
                          </td>
                          <td className="p-2 truncate max-w-[120px]" title={event.summary}>{event.summary}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredICSEvents.length > 20 && (
                  <p className="p-2 text-center text-gray-500">...and {filteredICSEvents.length - 20} more events</p>
                )}
                {filteredICSEvents.length === 0 && (
                  <p className="p-4 text-center text-gray-500">No events in selected date range</p>
                )}
              </div>
            </div>

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
