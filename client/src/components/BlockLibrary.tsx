import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, CATEGORIES, GOLDEN_RULE_BUCKETS, GoldenRuleBucketId, COLOR_PALETTE, Category } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { formatDuration } from '@/lib/time';
import { v4 as uuidv4 } from 'uuid';

interface DraggableTemplateProps {
  template: BlockTemplate;
  onEdit: () => void;
}

function DraggableTemplate({ template, onEdit }: DraggableTemplateProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'template', template },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded border cursor-grab active:cursor-grabbing transition-opacity ${isDragging ? 'opacity-50' : ''}`}
      style={{ 
        backgroundColor: template.colorHex + '20',
        borderColor: template.colorHex,
      }}
      data-testid={`template-${template.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{template.title}</p>
          <p className="text-xs text-gray-500">{template.category}</p>
          <p className="text-xs text-gray-400 mt-1">{formatDuration(template.defaultDurationMinutes)}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="px-2 py-1 text-xs border rounded hover:bg-white/50"
          data-testid={`edit-template-${template.id}`}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

interface TemplateFormData {
  title: string;
  category: Category;
  defaultDurationMinutes: number;
  colorHex: string;
  countsTowardGoldenRule: boolean;
  goldenRuleBucketId: GoldenRuleBucketId | '';
  defaultLocation: string;
  defaultNotes: string;
}

const DEFAULT_FORM: TemplateFormData = {
  title: '',
  category: 'PD',
  defaultDurationMinutes: 60,
  colorHex: COLOR_PALETTE[0].hex,
  countsTowardGoldenRule: true,
  goldenRuleBucketId: '',
  defaultLocation: '',
  defaultNotes: '',
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480];

export function BlockLibrary() {
  const { state, dispatch } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(DEFAULT_FORM);

  const filteredTemplates = state.templates.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = () => {
    if (!formData.title.trim()) return;
    if (formData.defaultDurationMinutes % 15 !== 0) {
      alert('Duration must be a multiple of 15 minutes');
      return;
    }
    
    const template: BlockTemplate = {
      id: uuidv4(),
      title: formData.title.trim(),
      category: formData.category,
      colorHex: formData.colorHex,
      defaultDurationMinutes: formData.defaultDurationMinutes,
      countsTowardGoldenRule: formData.countsTowardGoldenRule,
      goldenRuleBucketId: formData.countsTowardGoldenRule && formData.goldenRuleBucketId 
        ? formData.goldenRuleBucketId 
        : null,
      defaultLocation: formData.defaultLocation,
      defaultNotes: formData.defaultNotes,
    };
    
    dispatch({ type: 'ADD_TEMPLATE', payload: template });
    setShowCreate(false);
    setFormData(DEFAULT_FORM);
  };

  const handleEdit = () => {
    if (!editingId || !formData.title.trim()) return;
    if (formData.defaultDurationMinutes % 15 !== 0) {
      alert('Duration must be a multiple of 15 minutes');
      return;
    }
    
    const template: BlockTemplate = {
      id: editingId,
      title: formData.title.trim(),
      category: formData.category,
      colorHex: formData.colorHex,
      defaultDurationMinutes: formData.defaultDurationMinutes,
      countsTowardGoldenRule: formData.countsTowardGoldenRule,
      goldenRuleBucketId: formData.countsTowardGoldenRule && formData.goldenRuleBucketId 
        ? formData.goldenRuleBucketId 
        : null,
      defaultLocation: formData.defaultLocation,
      defaultNotes: formData.defaultNotes,
    };
    
    dispatch({ type: 'UPDATE_TEMPLATE', payload: template });
    setEditingId(null);
    setFormData(DEFAULT_FORM);
  };

  const handleDelete = () => {
    if (deleteId) {
      dispatch({ type: 'DELETE_TEMPLATE', payload: deleteId });
      setDeleteId(null);
    }
  };

  const handleDuplicate = () => {
    if (editingId) {
      dispatch({ type: 'DUPLICATE_TEMPLATE', payload: editingId });
      setEditingId(null);
      setFormData(DEFAULT_FORM);
    }
  };

  const openEdit = (template: BlockTemplate) => {
    setFormData({
      title: template.title,
      category: template.category,
      defaultDurationMinutes: template.defaultDurationMinutes,
      colorHex: template.colorHex,
      countsTowardGoldenRule: template.countsTowardGoldenRule,
      goldenRuleBucketId: template.goldenRuleBucketId || '',
      defaultLocation: template.defaultLocation,
      defaultNotes: template.defaultNotes,
    });
    setEditingId(template.id);
  };

  const TemplateForm = ({ isEdit }: { isEdit: boolean }) => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <input
          type="text"
          value={formData.title}
          onChange={e => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="template-title-input"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={formData.category}
            onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="template-category-select"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Default Duration *</label>
          <select
            value={formData.defaultDurationMinutes}
            onChange={e => setFormData({ ...formData, defaultDurationMinutes: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="template-duration-select"
          >
            {DURATION_OPTIONS.map(dur => (
              <option key={dur} value={dur}>{formatDuration(dur)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={formData.countsTowardGoldenRule}
            onChange={e => setFormData({ ...formData, countsTowardGoldenRule: e.target.checked })}
            data-testid="template-counts-golden-rule"
          />
          Counts toward Golden Rule hours
        </label>
      </div>

      {formData.countsTowardGoldenRule && (
        <div>
          <label className="block text-sm font-medium mb-1">Golden Rule Bucket *</label>
          <select
            value={formData.goldenRuleBucketId}
            onChange={e => setFormData({ ...formData, goldenRuleBucketId: e.target.value as GoldenRuleBucketId | '' })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            data-testid="template-golden-rule-select"
          >
            <option value="">Select a bucket...</option>
            {GOLDEN_RULE_BUCKETS.map(bucket => (
              <option key={bucket.id} value={bucket.id}>{bucket.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Default Location</label>
        <input
          type="text"
          value={formData.defaultLocation}
          onChange={e => setFormData({ ...formData, defaultLocation: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Classroom 1, Shop"
          data-testid="template-location-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Default Notes</label>
        <textarea
          value={formData.defaultNotes}
          onChange={e => setFormData({ ...formData, defaultNotes: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          data-testid="template-notes-input"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Color</label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PALETTE.map(color => (
            <button
              key={color.hex}
              type="button"
              onClick={() => setFormData({ ...formData, colorHex: color.hex })}
              className={`w-8 h-8 rounded border-2 ${formData.colorHex === color.hex ? 'border-gray-900' : 'border-transparent'}`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              data-testid={`template-color-${color.name}`}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        {isEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setDeleteId(editingId)}
              className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
              data-testid="delete-template-button"
            >
              Delete
            </button>
            <button
              onClick={handleDuplicate}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="duplicate-template-button"
            >
              Duplicate
            </button>
          </div>
        )}
        <div className="flex gap-3 ml-auto">
          <button
            onClick={() => {
              setShowCreate(false);
              setEditingId(null);
              setFormData(DEFAULT_FORM);
            }}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            data-testid="cancel-template-button"
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleEdit : handleCreate}
            disabled={!formData.title.trim() || (formData.countsTowardGoldenRule && !formData.goldenRuleBucketId)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            data-testid="save-template-button"
          >
            {isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Block Library</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="create-template-button"
          >
            New
          </button>
        </div>
        
        <input
          type="search"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border rounded text-sm mb-2"
          data-testid="template-search-input"
        />
        
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | 'all')}
          className="w-full px-3 py-2 border rounded text-sm"
          data-testid="template-category-filter"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        {filteredTemplates.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No templates found</p>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map(template => (
              <DraggableTemplate
                key={template.id}
                template={template}
                onEdit={() => openEdit(template)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Template">
        <TemplateForm isEdit={false} />
      </Modal>

      <Modal open={editingId !== null} onClose={() => { setEditingId(null); setFormData(DEFAULT_FORM); }} title="Edit Template">
        <TemplateForm isEdit={true} />
      </Modal>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? Placed blocks using this template will remain."
        confirmText="Delete"
      />
    </div>
  );
}
