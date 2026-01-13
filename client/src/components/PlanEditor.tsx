import { useState, useEffect } from 'react';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DAYS, Day } from '@/state/types';
import { Modal } from './Modal';

interface PlanEditorProps {
  plan: Plan;
  open: boolean;
  onClose: () => void;
}

export function PlanEditor({ plan, open, onClose }: PlanEditorProps) {
  const { dispatch } = useStore();
  const [formData, setFormData] = useState<PlanSettings>(plan.settings);

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
            <input
              type="time"
              value={formData.dayStartTime}
              onChange={e => setFormData({ ...formData, dayStartTime: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="edit-plan-start-time-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Day End Time</label>
            <input
              type="time"
              value={formData.dayEndTime}
              onChange={e => setFormData({ ...formData, dayEndTime: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="edit-plan-end-time-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Slot Size</label>
          <input
            type="text"
            value="15 minutes (fixed)"
            disabled
            className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">All scheduling uses 15-minute increments</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Enabled Days</label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(day => (
              <label key={day} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={formData.enabledDays.includes(day)}
                  onChange={e => {
                    if (e.target.checked) {
                      setFormData({ ...formData, enabledDays: [...formData.enabledDays, day] });
                    } else {
                      setFormData({ ...formData, enabledDays: formData.enabledDays.filter(d => d !== day) });
                    }
                  }}
                  data-testid={`edit-plan-day-${day}`}
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="editLunchEnabled"
            checked={formData.lunchEnabled}
            onChange={e => setFormData({ ...formData, lunchEnabled: e.target.checked })}
            data-testid="edit-plan-lunch-enabled"
          />
          <label htmlFor="editLunchEnabled" className="text-sm font-medium">Enable Lunch Break</label>
        </div>

        {formData.lunchEnabled && (
          <div className="grid grid-cols-2 gap-4 pl-6">
            <div>
              <label className="block text-sm font-medium mb-1">Lunch Start</label>
              <input
                type="time"
                value={formData.lunchStartTime}
                onChange={e => setFormData({ ...formData, lunchStartTime: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="edit-plan-lunch-start-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration (min)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={formData.lunchDurationMin}
                onChange={e => setFormData({ ...formData, lunchDurationMin: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="edit-plan-lunch-duration-input"
              />
            </div>
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
