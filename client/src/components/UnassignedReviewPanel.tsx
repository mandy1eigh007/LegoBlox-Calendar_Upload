import { useState, useMemo } from 'react';
import { Plan, PlacedBlock, BlockTemplate, DAYS, GOLDEN_RULE_BUCKETS } from '@/state/types';
import { minutesToTimeDisplay } from '@/lib/time';
import { Modal } from './Modal';

interface UnassignedReviewPanelProps {
  plan: Plan;
  templates: BlockTemplate[];
  open: boolean;
  onClose: () => void;
  onAssignBlock: (blockId: string, templateId: string) => void;
  onAssignMultiple: (blockIds: string[], templateId: string) => void;
}

export function UnassignedReviewPanel({
  plan,
  templates,
  open,
  onClose,
  onAssignBlock,
  onAssignMultiple,
}: UnassignedReviewPanelProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [bulkTemplateId, setBulkTemplateId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const unassignedBlocks = useMemo(() => 
    plan.blocks.filter(b => b.templateId === null),
    [plan.blocks]
  );

  const groupedByTitle = useMemo(() => {
    const groups: Record<string, PlacedBlock[]> = {};
    for (const block of unassignedBlocks) {
      const title = block.titleOverride || 'Unknown';
      if (!groups[title]) groups[title] = [];
      groups[title].push(block);
    }
    return groups;
  }, [unassignedBlocks]);

  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [templates, searchQuery]);

  const toggleBlock = (id: string) => {
    const newSet = new Set(selectedBlocks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBlocks(newSet);
  };

  const selectByTitle = (title: string) => {
    const blocks = groupedByTitle[title] || [];
    const newSet = new Set(selectedBlocks);
    for (const b of blocks) {
      newSet.add(b.id);
    }
    setSelectedBlocks(newSet);
  };

  const handleBulkAssign = () => {
    if (!bulkTemplateId || selectedBlocks.size === 0) return;
    onAssignMultiple(Array.from(selectedBlocks), bulkTemplateId);
    setSelectedBlocks(new Set());
    setBulkTemplateId('');
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (unassignedBlocks.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Unassigned Items">
        <div className="py-8 text-center text-gray-500">
          No unassigned blocks found. All blocks have been assigned to templates.
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Unassigned Items">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="font-medium">{unassignedBlocks.length} unassigned block{unassignedBlocks.length !== 1 ? 's' : ''}</p>
          <p className="text-xs mt-1">These blocks do not count toward Golden Rule totals until assigned to a template.</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">Bulk Assignment</p>
          <div className="flex gap-2">
            <select
              value={bulkTemplateId}
              onChange={(e) => setBulkTemplateId(e.target.value)}
              className="flex-1 text-sm border rounded px-2 py-1.5"
              data-testid="bulk-template-select"
            >
              <option value="">Select template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkTemplateId || selectedBlocks.size === 0}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              data-testid="bulk-assign-button"
            >
              Assign {selectedBlocks.size} Selected
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">By Title</span>
            <span className="text-xs text-gray-500">{Object.keys(groupedByTitle).length} unique titles</span>
          </div>
          
          <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
            {Object.entries(groupedByTitle).map(([title, blocks]) => (
              <div key={title} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-gray-500">{blocks.length} occurrence{blocks.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => selectByTitle(title)}
                    className="text-xs text-blue-600 hover:underline"
                    data-testid={`select-title-${title.replace(/\s+/g, '-')}`}
                  >
                    Select All
                  </button>
                </div>
                
                <div className="space-y-1">
                  {blocks.map(block => (
                    <label key={block.id} className="flex items-center gap-2 text-xs hover:bg-gray-50 p-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlocks.has(block.id)}
                        onChange={() => toggleBlock(block.id)}
                        className="rounded"
                      />
                      <span className="text-gray-600">
                        Week {block.week} {block.day} {minutesToTimeDisplay(block.startMinutes)} ({formatDuration(block.durationMinutes)})
                      </span>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) onAssignBlock(block.id, e.target.value);
                        }}
                        className="ml-auto text-xs border rounded px-1 py-0.5"
                        data-testid={`assign-block-${block.id}`}
                      >
                        <option value="">Assign...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
