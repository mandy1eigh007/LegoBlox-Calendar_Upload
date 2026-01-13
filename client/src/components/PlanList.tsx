import { useState } from 'react';
import { useLocation } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, PlanSettings, DEFAULT_RESOURCES } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { createDefaultPlanSettings } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export function PlanList() {
  const { state, dispatch } = useStore();
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanSettings>(createDefaultPlanSettings());

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cohort Schedule Builder</h1>
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
    </div>
  );
}
