import { useState, useEffect } from 'react';
import { PlacedBlock, BlockTemplate, ALLOWED_DURATIONS, AllowedDuration } from '@/state/types';
import { formatDuration, formatTimeDisplay, getEndTime } from '@/lib/time';
import { ConfirmModal } from './Modal';

interface BlockEditPanelProps {
  block: PlacedBlock;
  template: BlockTemplate | undefined;
  onUpdate: (block: PlacedBlock) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BlockEditPanel({ block, template, onUpdate, onDelete, onClose }: BlockEditPanelProps) {
  const [titleOverride, setTitleOverride] = useState(block.titleOverride || '');
  const [durationMin, setDurationMin] = useState<AllowedDuration>(block.durationMin);
  const [location, setLocation] = useState(block.location || '');
  const [notes, setNotes] = useState(block.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setTitleOverride(block.titleOverride || '');
    setDurationMin(block.durationMin);
    setLocation(block.location || '');
    setNotes(block.notes || '');
  }, [block]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setShowDeleteConfirm(true);
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    onUpdate({
      ...block,
      titleOverride: titleOverride.trim() || undefined,
      durationMin,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const title = template?.title || 'Unknown Block';

  return (
    <div className="w-80 bg-white border-l h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Edit Block</h3>
        <button
          onClick={onClose}
          className="px-2 py-1 text-sm hover:bg-gray-100 rounded"
          data-testid="close-edit-panel"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Template</p>
            <p className="font-medium">{title}</p>
            {template && (
              <p className="text-xs text-gray-500">{template.category} | {template.goldenRuleTopic}</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">Time</p>
            <p className="text-sm">
              {formatTimeDisplay(block.startTime)} - {formatTimeDisplay(getEndTime(block.startTime, block.durationMin))}
            </p>
            <p className="text-xs text-gray-500">Week {block.week}, {block.day}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title Override</label>
            <input
              type="text"
              value={titleOverride}
              onChange={e => setTitleOverride(e.target.value)}
              placeholder={title}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-title-override-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Duration</label>
            <select
              value={durationMin}
              onChange={e => setDurationMin(parseInt(e.target.value) as AllowedDuration)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-duration-select"
            >
              {ALLOWED_DURATIONS.map(dur => (
                <option key={dur} value={dur}>{formatDuration(dur)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={template?.defaultLocation || 'Optional'}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-location-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={template?.defaultNotes || 'Optional'}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              data-testid="block-notes-input"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t">
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
            data-testid="delete-block-button"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="save-block-button"
          >
            Save
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDelete}
        title="Delete Block"
        message="Are you sure you want to delete this block from the schedule?"
        confirmText="Delete"
      />
    </div>
  );
}
