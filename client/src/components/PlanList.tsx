import { useState } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DAYS, Day } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS: PlanSettings = {
  name: '',
  weeks: 9,
  enabledDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'] as Day[],
  dayStartTime: '06:30',
  dayEndTime: '15:30',
  slotMin: 15,
  lunchEnabled: true,
  lunchStartTime: '11:00',
  lunchDurationMin: 60,
};

export function PlanList() {
  const { state, dispatch } = useStore();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanSettings>(DEFAULT_SETTINGS);

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    
    const plan: Plan = {
      id: uuidv4(),
      settings: { ...formData },
      blocks: [],
    };
    
    dispatch({ type: 'ADD_PLAN', payload: plan });
    setShowCreate(false);
    setFormData(DEFAULT_SETTINGS);
    navigate(`/plan/${plan.id}`);
  };

  const handleDelete = () => {
    if (deleteId) {
      dispatch({ type: 'DELETE_PLAN', payload: deleteId });
      setDeleteId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Schedule Builder</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="create-plan-button"
          >
            Create New Plan
          </button>
        </div>

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
                    {plan.settings.weeks} weeks | {plan.blocks.length} blocks | {plan.settings.enabledDays.length} days
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
              placeholder="Enter plan name"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Day Start Time</label>
              <input
                type="time"
                value={formData.dayStartTime}
                onChange={e => setFormData({ ...formData, dayStartTime: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="plan-start-time-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Day End Time</label>
              <input
                type="time"
                value={formData.dayEndTime}
                onChange={e => setFormData({ ...formData, dayEndTime: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="plan-end-time-input"
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
                    data-testid={`plan-day-${day}`}
                  />
                  {day.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lunchEnabled"
              checked={formData.lunchEnabled}
              onChange={e => setFormData({ ...formData, lunchEnabled: e.target.checked })}
              data-testid="plan-lunch-enabled"
            />
            <label htmlFor="lunchEnabled" className="text-sm font-medium">Enable Lunch Break</label>
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
                  data-testid="plan-lunch-start-input"
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
                  data-testid="plan-lunch-duration-input"
                />
              </div>
            </div>
          )}

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
    </div>
  );
}
