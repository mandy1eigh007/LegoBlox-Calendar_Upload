import { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useStore } from '@/state/store';
import { BlockTemplate, CATEGORIES, GOLDEN_RULE_BUCKETS, GoldenRuleBucketId, COLOR_PALETTE, Category, DEFAULT_RESOURCES } from '@/state/types';
import { Modal, ConfirmModal } from './Modal';
import { formatDuration } from '@/lib/time';
import { createSeedTemplates } from '@/lib/seedTemplates';
import { v4 as uuidv4 } from 'uuid';

interface DraggableTemplateProps {
  template: BlockTemplate;
  onEdit: () => void;
}

function DraggableTemplate({ template, onEdit }: DraggableTemplateProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-${template.id}`,
    data: { type: 'template', template },
    disabled: !!template.isArchived,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded border transition-opacity ${template.isArchived ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-50' : ''}`}
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
          {template.isArchived && (
            <p className="text-[10px] text-amber-600 mt-1">Archived</p>
          )}
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
  defaultResource: string;
  matchKeywords: string;
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
  defaultResource: '',
  matchKeywords: '',
};

const DURATION_OPTIONS = Array.from({ length: 36 }, (_, i) => (i + 1) * 15);

interface BlockLibraryProps {
  externalEditTemplateId?: string | null;
  onExternalEditHandled?: () => void;
}

export function BlockLibrary({ externalEditTemplateId, onExternalEditHandled }: BlockLibraryProps) {
  const { state, dispatch } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(DEFAULT_FORM);

  const isTemplateUsed = (templateId: string) => 
    state.plans.some(plan => plan.blocks.some(block => block.templateId === templateId));
  const isTemplateUsedInPublishedPlan = (templateId: string) =>
    state.plans.some(plan => plan.isPublished && plan.blocks.some(block => block.templateId === templateId));

  const editingTemplate = editingId ? state.templates.find(t => t.id === editingId) : null;
  const isEditingArchived = !!editingTemplate?.isArchived;
  const isEditingUsedInPublished = editingId ? isTemplateUsedInPublishedPlan(editingId) : false;

  const handleResetTemplates = () => {
    const defaultTemplates = createSeedTemplates();
    dispatch({ type: 'RESET_TEMPLATES', payload: defaultTemplates });
    setShowResetConfirm(false);
  };

  const filteredTemplates = state.templates.filter(t => {
    if (!showArchived && t.isArchived) return false;
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
    
    const keywords = formData.matchKeywords.trim()
      ? formData.matchKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : undefined;
    
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
      defaultResource: formData.defaultResource || undefined,
      matchKeywords: keywords,
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
    
    const keywords = formData.matchKeywords.trim()
      ? formData.matchKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
      : undefined;
    
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
      defaultResource: formData.defaultResource || undefined,
      matchKeywords: keywords,
    };
    
    dispatch({ type: 'UPDATE_TEMPLATE', payload: template });
    setEditingId(null);
    setFormData(DEFAULT_FORM);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const template = state.templates.find(t => t.id === deleteId);
    if (!template) {
      setDeleteId(null);
      return;
    }
    const usedInPublished = isTemplateUsedInPublishedPlan(deleteId);
    if (usedInPublished) {
      dispatch({ type: 'UPDATE_TEMPLATE', payload: { ...template, isArchived: true } });
    } else {
      dispatch({ type: 'DELETE_TEMPLATE', payload: deleteId });
    }
    setDeleteId(null);
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
      defaultResource: template.defaultResource || '',
      matchKeywords: template.matchKeywords?.join(', ') || '',
    });
    setEditingId(template.id);
  };

  useEffect(() => {
    if (!externalEditTemplateId) return;
    const template = state.templates.find(t => t.id === externalEditTemplateId);
    if (template) {
      openEdit(template);
    }
    onExternalEditHandled?.();
  }, [externalEditTemplateId, onExternalEditHandled, state.templates]);
  
  const adjustFormDuration = (delta: number) => {
    const newDuration = Math.max(15, Math.min(formData.defaultDurationMinutes + delta, 540));
    setFormData({ ...formData, defaultDurationMinutes: newDuration });
  };

  const deleteUsed = deleteId ? isTemplateUsed(deleteId) : false;
  const deleteUsedInPublished = deleteId ? isTemplateUsedInPublishedPlan(deleteId) : false;

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
      
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjustFormDuration(-15)}
          disabled={formData.defaultDurationMinutes <= 15}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          data-testid="template-duration-minus-15"
        >
          -15 min
        </button>
        <span className="text-sm text-gray-600 flex-1 text-center">{formatDuration(formData.defaultDurationMinutes)}</span>
        <button
          type="button"
          onClick={() => adjustFormDuration(15)}
          disabled={formData.defaultDurationMinutes >= 540}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
          data-testid="template-duration-plus-15"
        >
          +15 min
        </button>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Default Resource/Room</label>
        <select
          value={formData.defaultResource}
          onChange={e => setFormData({ ...formData, defaultResource: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="template-resource-select"
        >
          <option value="">No default resource</option>
          {DEFAULT_RESOURCES.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
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
        <label className="block text-sm font-medium mb-1">Match Keywords</label>
        <input
          type="text"
          value={formData.matchKeywords}
          onChange={e => setFormData({ ...formData, matchKeywords: e.target.value })}
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. resume, cv, cover letter"
          data-testid="template-keywords-input"
        />
        <p className="text-xs text-gray-500 mt-1">Comma-separated keywords to help match imported events</p>
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
            {isEditingArchived ? (
              <button
                onClick={() => {
                  if (!editingTemplate) return;
                  dispatch({ type: 'UPDATE_TEMPLATE', payload: { ...editingTemplate, isArchived: false } });
                }}
                className="px-4 py-2 text-sm border border-amber-500/30 text-amber-300 rounded-lg hover:bg-amber-500/10 transition-all"
                data-testid="restore-template-button"
              >
                Restore
              </button>
            ) : (
              <button
                onClick={() => setDeleteId(editingId)}
                className="px-4 py-2 text-sm border border-red-500/30 text-red-300 rounded-lg hover:bg-red-500/10 transition-all"
                data-testid="delete-template-button"
              >
                {isEditingUsedInPublished ? 'Archive' : 'Delete'}
              </button>
            )}
            <button
              onClick={handleDuplicate}
              className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              data-testid="duplicate-template-button"
              disabled={isEditingArchived}
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
            className="px-4 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
            data-testid="cancel-template-button"
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleEdit : handleCreate}
            disabled={!formData.title.trim() || (formData.countsTowardGoldenRule && !formData.goldenRuleBucketId)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 glow-primary disabled:opacity-50 transition-all"
            data-testid="save-template-button"
          >
            {isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col glass-panel border-r border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Block Library</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-2 py-1 text-xs border border-border rounded-lg text-muted-foreground hover:bg-secondary/50 transition-all"
              data-testid="reset-templates-button"
            >
              Reset
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 glow-primary transition-all"
              data-testid="create-template-button"
            >
              New
            </button>
          </div>
        </div>
        
        <input
          type="search"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground mb-2"
          data-testid="template-search-input"
        />
        
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | 'all')}
          className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground"
          data-testid="template-category-filter"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        
        <label className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="accent-primary"
            data-testid="toggle-archived-templates"
          />
          Show archived templates
        </label>
      </div>

      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        {filteredTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No templates found</p>
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
        title={deleteUsedInPublished ? 'Archive Template' : 'Delete Template'}
        message={
          deleteUsedInPublished
            ? 'This template is used in a published plan. It will be archived and hidden, but kept so student views stay intact.'
            : deleteUsed
              ? 'This template is used in schedules. Deleting will keep existing blocks but they will no longer have a template.'
              : 'Are you sure you want to delete this template?'
        }
        confirmText={deleteUsedInPublished ? 'Archive' : 'Delete'}
      />

      <ConfirmModal
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetTemplates}
        title="Reset Templates"
        message="This will replace all your templates with the default set of 37+ templates matching Golden Rule categories. Any custom templates will be lost. Continue?"
        confirmText="Reset"
      />
    </div>
  );
}
