import { useState, useEffect } from 'react';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES } from '@/state/types';
import { Modal } from './Modal';
import { minutesToTimeDisplay, DAY_START_DEFAULT, DAY_END_DEFAULT, SLOT_HEIGHT_PX, SLOT_MINUTES } from '@/lib/time';

interface PlanEditorProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
  onToggleDiagnostics?: () => void;
  showDiagnostics?: boolean;
}

const TIME_OPTIONS: number[] = [];
for (let h = 5; h <= 20; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(h * 60 + m);
  }
}

export function PlanEditor({ plan, open, onClose, onToggleDiagnostics, showDiagnostics }: PlanEditorProps) {
  const { dispatch } = useStore();
  const [formData, setFormData] = useState<PlanSettings>(plan.settings);
  const [newResource, setNewResource] = useState('');

  useEffect(() => {
    setFormData(plan.settings);
  }, [plan.settings, open]);

  const handleSave = () => {
    dispatch({
      type: 'UPDATE_PLAN',
      payload: { ...plan, settings: formData },
    });
    onClose();
  };

  const addResource = () => {
    if (newResource.trim() && !formData.resources.includes(newResource.trim())) {
      setFormData({
        ...formData,
        resources: [...formData.resources, newResource.trim()],
      });
      setNewResource('');
    }
  };

  const removeResource = (resource: string) => {
    setFormData({
      ...formData,
      resources: formData.resources.filter(r => r !== resource),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Plan Settings">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Plan Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="edit-plan-name-input"
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
            data-testid="edit-plan-weeks-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Day Start Time</label>
            <select
              value={formData.dayStartMinutes}
              onChange={e => setFormData({ ...formData, dayStartMinutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="edit-plan-start-time"
            >
              {TIME_OPTIONS.map(m => (
                <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Day End Time</label>
            <select
              value={formData.dayEndMinutes}
              onChange={e => setFormData({ ...formData, dayEndMinutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="edit-plan-end-time"
            >
              {TIME_OPTIONS.map(m => (
                <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Time Slot Size</label>
          <input
            type="text"
            value="15 minutes (fixed)"
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={formData.allowOverlaps}
              onChange={e => setFormData({ ...formData, allowOverlaps: e.target.checked })}
              data-testid="edit-plan-allow-overlaps"
            />
            Allow overlapping blocks
          </label>
          <p className="text-xs text-gray-500 mt-1">When disabled, blocks cannot be placed on top of each other</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={formData.showNotesOnPrint}
              onChange={e => setFormData({ ...formData, showNotesOnPrint: e.target.checked })}
              data-testid="edit-plan-show-notes-print"
            />
            Show notes on print view
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Resources / Locations</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.resources.map(r => (
              <span
                key={r}
                className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1"
              >
                {r}
                <button
                  onClick={() => removeResource(r)}
                  className="text-gray-500 hover:text-red-500"
                  type="button"
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newResource}
              onChange={e => setNewResource(e.target.value)}
              placeholder="Add resource..."
              className="flex-1 px-3 py-2 border rounded text-sm"
              onKeyDown={e => e.key === 'Enter' && addResource()}
            />
            <button
              onClick={addResource}
              type="button"
              className="px-3 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Add
            </button>
          </div>
        </div>

        {onToggleDiagnostics && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={showDiagnostics}
                onChange={onToggleDiagnostics}
                data-testid="edit-plan-diagnostics"
              />
              Show diagnostics panel
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Displays slotHeightPx ({SLOT_HEIGHT_PX}), slotMinutes ({SLOT_MINUTES}), and hover position
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            data-testid="cancel-edit-plan"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-edit-plan"
          >
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
}
