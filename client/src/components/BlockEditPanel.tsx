import { useState, useEffect } from 'react';
import { PlacedBlock, BlockTemplate } from '@/state/types';
import { formatDuration, formatTimeDisplay, getEndTime, timeToMinutes, minutesToTime } from '@/lib/time';
import { ConfirmModal, Modal } from './Modal';

interface BlockEditPanelProps {
  block: PlacedBlock;
  template: BlockTemplate | undefined;
  dayEndTime: string;
  onUpdate: (block: PlacedBlock) => void;
  onDelete: () => void;
  onSplit: (blockId: string, splitAfterMinutes: number) => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 480];

export function BlockEditPanel({ block, template, dayEndTime, onUpdate, onDelete, onSplit, onDuplicate, onClose }: BlockEditPanelProps) {
  const [titleOverride, setTitleOverride] = useState(block.titleOverride || '');
  const [durationMin, setDurationMin] = useState<number>(block.durationMin);
  const [location, setLocation] = useState(block.location || '');
  const [notes, setNotes] = useState(block.notes || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitAfter, setSplitAfter] = useState(15);

  useEffect(() => {
    setTitleOverride(block.titleOverride || '');
    setDurationMin(block.durationMin);
    setLocation(block.location || '');
    setNotes(block.notes || '');
    setSplitAfter(15);
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
    const startMinutes = timeToMinutes(block.startTime);
    const endMinutes = timeToMinutes(dayEndTime);
    const maxDuration = endMinutes - startMinutes;
    
    if (durationMin > maxDuration) {
      alert(`Duration would extend past ${formatTimeDisplay(dayEndTime)}. Maximum duration from this start time is ${formatDuration(maxDuration)}.`);
      return;
    }
    
    onUpdate({
      ...block,
      titleOverride: titleOverride.trim() || undefined,
      durationMin,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleSplit = () => {
    onSplit(block.id, splitAfter);
    setShowSplitModal(false);
  };

  const title = template?.title || 'Unknown Block';
  const canSplit = block.durationMin >= 30;
  
  const splitOptions: number[] = [];
  for (let i = 15; i < block.durationMin; i += 15) {
    splitOptions.push(i);
  }

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

      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Template</p>
            <p className="font-medium">{title}</p>
            {template && (
              <>
                <p className="text-xs text-gray-500">{template.category}</p>
                {template.goldenRuleKey && (
                  <p className="text-xs text-blue-600 mt-1">
                    Counts toward: {template.goldenRuleKey}
                  </p>
                )}
              </>
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
            <label className="block text-sm font-medium mb-1">Duration (15-min increments)</label>
            <select
              value={durationMin}
              onChange={e => setDurationMin(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-duration-select"
            >
              {DURATION_OPTIONS.map(dur => (
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
              placeholder="Optional"
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-location-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              data-testid="block-notes-input"
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onDuplicate}
            className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
            data-testid="duplicate-block-button"
          >
            Duplicate
          </button>
          {canSplit && (
            <button
              onClick={() => setShowSplitModal(true)}
              className="flex-1 px-3 py-2 text-sm border rounded hover:bg-gray-50"
              data-testid="split-block-button"
            >
              Split
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
            data-testid="delete-block-button"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
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

      <Modal open={showSplitModal} onClose={() => setShowSplitModal(false)} title="Split Block">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Split this {formatDuration(block.durationMin)} block into two blocks.
          </p>
          
          <div>
            <label className="block text-sm font-medium mb-1">Split after:</label>
            <select
              value={splitAfter}
              onChange={e => setSplitAfter(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm"
              data-testid="split-time-select"
            >
              {splitOptions.map(mins => {
                const splitTime = minutesToTime(timeToMinutes(block.startTime) + mins);
                return (
                  <option key={mins} value={mins}>
                    {formatDuration(mins)} ({formatTimeDisplay(splitTime)})
                  </option>
                );
              })}
            </select>
          </div>

          <p className="text-xs text-gray-500">
            This will create two blocks: {formatDuration(splitAfter)} + {formatDuration(block.durationMin - splitAfter)}
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowSplitModal(false)}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSplit}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid="confirm-split-button"
            >
              Split
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
