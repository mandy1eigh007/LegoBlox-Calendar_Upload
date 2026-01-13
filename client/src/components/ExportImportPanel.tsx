import { useState, useRef } from 'react';
import { useStore } from '@/state/store';
import { Plan, AppState } from '@/state/types';
import { exportToCSV, exportToICS, downloadCSV, downloadJSON, downloadICS, importICSToBlocks } from '@/lib/csv';
import { validateAppState } from '@/state/validators';
import { Modal } from './Modal';

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
          
          <div className="flex gap-3">
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
