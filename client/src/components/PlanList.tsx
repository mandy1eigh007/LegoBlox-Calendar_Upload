import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES, AppState, PlacedBlock, Day, DAYS } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { createDefaultPlanSettings } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { validateAppState } from '@/state/validators';
import { processImageWithOCR, OCREvent } from '@/lib/ocr';
import { Camera, Upload, Loader2 } from 'lucide-react';

export function PlanList() {
  const { state, dispatch } = useStore();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanSettings>(createDefaultPlanSettings());
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [ocrProcessing, setOCRProcessing] = useState(false);
  const [ocrProgress, setOCRProgress] = useState(0);
  const [ocrEvents, setOCREvents] = useState<OCREvent[]>([]);
  const [ocrPlanName, setOCRPlanName] = useState('');
  const [ocrRawText, setOCRRawText] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEvents, setManualEvents] = useState<Array<{id: string; title: string; day: Day; startMinutes: number; durationMinutes: number}>>([]);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Cohort Schedule Builder</h1>
          <div className="flex gap-2 flex-wrap">
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
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
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"
              data-testid="import-json-button"
            >
              <Upload className="w-4 h-4" />
              Import Backup
            </button>
            <button
              onClick={() => ocrInputRef.current?.click()}
              className="px-4 py-2 border rounded hover:bg-gray-50 flex items-center gap-2"
              data-testid="import-screenshot-button"
            >
              <Camera className="w-4 h-4" />
              Import Screenshot
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
        
        {importError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm" data-testid="home-import-error">
            {importError}
            <button onClick={() => setImportError(null)} className="ml-2 underline">Dismiss</button>
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
    </div>
  );
}
