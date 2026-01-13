import { useState, useEffect } from 'react';
import { PlacedBlock, BlockTemplate, Plan, GOLDEN_RULE_BUCKETS, GoldenRuleBucketId, ApplyScope, DAYS, Day, RecurrenceType, RecurrencePattern, RecurrenceSeries } from '@/state/types';
import { formatDuration, minutesToTimeDisplay, getEndMinutes } from '@/lib/time';
import { ConfirmModal, Modal } from './Modal';
import { createRecurringBlocks } from '@/lib/recurrence';

interface BlockEditPanelProps {
  block: PlacedBlock;
  template: BlockTemplate | undefined;
  plan: Plan;
  onUpdate: (block: PlacedBlock, scope?: ApplyScope) => void;
  onDelete: (scope?: ApplyScope) => void;
  onDuplicate: () => void;
  onClose: () => void;
  onCreateRecurrence?: (blocks: PlacedBlock[], series?: RecurrenceSeries) => void;
  onUpdateRecurrence?: (seriesId: string, blocks: PlacedBlock[], series: RecurrenceSeries) => void;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480, 540];

function generateTimeOptions(startMinutes: number, endMinutes: number): number[] {
  const options: number[] = [];
  for (let m = startMinutes; m < endMinutes; m += 15) {
    options.push(m);
  }
  return options;
}

export function BlockEditPanel({ block, template, plan, onUpdate, onDelete, onDuplicate, onClose, onCreateRecurrence, onUpdateRecurrence }: BlockEditPanelProps) {
  const [titleOverride, setTitleOverride] = useState(block.titleOverride);
  const [startMinutes, setStartMinutes] = useState(block.startMinutes);
  const [durationMinutes, setDurationMinutes] = useState(block.durationMinutes);
  const [location, setLocation] = useState(block.location);
  const [notes, setNotes] = useState(block.notes);
  const [countsTowardGoldenRule, setCountsTowardGoldenRule] = useState(block.countsTowardGoldenRule);
  const [goldenRuleBucketId, setGoldenRuleBucketId] = useState<GoldenRuleBucketId | ''>(block.goldenRuleBucketId || '');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceDays, setRecurrenceDays] = useState<Day[]>([block.day]);
  const [recurrenceStartWeek, setRecurrenceStartWeek] = useState(block.week);
  const [recurrenceEndWeek, setRecurrenceEndWeek] = useState(plan.settings.weeks);
  const [applyScopeAction, setApplyScopeAction] = useState<'save' | 'delete' | null>(null);

  const existingSeries = block.recurrenceSeriesId 
    ? plan.recurrenceSeries.find(s => s.id === block.recurrenceSeriesId)
    : null;

  useEffect(() => {
    setTitleOverride(block.titleOverride);
    setStartMinutes(block.startMinutes);
    setDurationMinutes(block.durationMinutes);
    setLocation(block.location);
    setNotes(block.notes);
    setCountsTowardGoldenRule(block.countsTowardGoldenRule);
    setGoldenRuleBucketId(block.goldenRuleBucketId || '');
    setRecurrenceDays([block.day]);
    setRecurrenceStartWeek(block.week);
  }, [block]);

  const openRecurrenceModal = () => {
    if (existingSeries) {
      setRecurrenceType(existingSeries.pattern.type);
      setRecurrenceDays(existingSeries.pattern.daysOfWeek);
      setRecurrenceStartWeek(existingSeries.pattern.startWeek);
      setRecurrenceEndWeek(existingSeries.pattern.endWeek);
    } else {
      setRecurrenceType('none');
      setRecurrenceDays([block.day]);
      setRecurrenceStartWeek(block.week);
      setRecurrenceEndWeek(plan.settings.weeks);
    }
    setShowRecurrence(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT') {
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

  const handleSave = (scope?: ApplyScope) => {
    onUpdate({
      ...block,
      titleOverride,
      startMinutes,
      durationMinutes,
      location,
      notes,
      countsTowardGoldenRule,
      goldenRuleBucketId: countsTowardGoldenRule && goldenRuleBucketId ? goldenRuleBucketId : null,
    }, scope);
  };

  const handleDelete = (scope?: ApplyScope) => {
    onDelete(scope);
    setShowDeleteConfirm(false);
  };

  const handleApplyRecurrence = () => {
    if (recurrenceType === 'none') {
      setShowRecurrence(false);
      return;
    }

    const pattern: RecurrencePattern = {
      type: recurrenceType,
      daysOfWeek: recurrenceType === 'weekly' ? [block.day] : recurrenceDays,
      startWeek: recurrenceStartWeek,
      endWeek: recurrenceEndWeek,
    };

    const currentBlock: PlacedBlock = {
      ...block,
      titleOverride,
      startMinutes,
      durationMinutes,
      location,
      notes,
      countsTowardGoldenRule,
      goldenRuleBucketId: countsTowardGoldenRule && goldenRuleBucketId ? goldenRuleBucketId : null,
    };

    if (existingSeries && onUpdateRecurrence) {
      const { series, blocks } = createRecurringBlocks(currentBlock, pattern, plan);
      onUpdateRecurrence(existingSeries.id, blocks, series);
    } else if (onCreateRecurrence) {
      const { series, blocks } = createRecurringBlocks(currentBlock, pattern, plan);
      onCreateRecurrence(blocks, series);
    }
    
    setShowRecurrence(false);
    onClose();
  };

  const title = template?.title || 'Unknown Block';
  const timeOptions = generateTimeOptions(plan.settings.dayStartMinutes, plan.settings.dayEndMinutes);
  const isRecurring = !!block.recurrenceSeriesId;

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
              <p className="text-xs text-gray-500">{template.category}</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">Placement</p>
            <p className="text-sm">Week {block.week}, {block.day}</p>
            <p className="text-sm">
              {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(getEndMinutes(block.startMinutes, block.durationMinutes))}
            </p>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <select
                value={startMinutes}
                onChange={e => setStartMinutes(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="block-start-time-select"
              >
                {timeOptions.map(m => (
                  <option key={m} value={m}>{minutesToTimeDisplay(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration</label>
              <select
                value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="block-duration-select"
              >
                {DURATION_OPTIONS.map(dur => (
                  <option key={dur} value={dur}>{formatDuration(dur)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="block-location-select"
            >
              <option value="">No location</option>
              {plan.settings.resources.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              data-testid="block-notes-input"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={countsTowardGoldenRule}
                onChange={e => setCountsTowardGoldenRule(e.target.checked)}
                data-testid="block-counts-golden-rule"
              />
              Counts toward Golden Rule
            </label>
          </div>

          {countsTowardGoldenRule && (
            <div>
              <label className="block text-sm font-medium mb-1">Golden Rule Bucket</label>
              <select
                value={goldenRuleBucketId}
                onChange={e => setGoldenRuleBucketId(e.target.value as GoldenRuleBucketId | '')}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="block-golden-rule-select"
              >
                <option value="">Select bucket...</option>
                {GOLDEN_RULE_BUCKETS.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </div>
          )}

          {isRecurring && existingSeries && (
            <div className="p-3 bg-blue-50 rounded text-xs space-y-2">
              <p className="font-medium">Recurring Series</p>
              <p className="text-gray-600">
                {existingSeries.pattern.type === 'weekly' 
                  ? `Every ${existingSeries.pattern.daysOfWeek[0]}`
                  : existingSeries.pattern.daysOfWeek.map(d => d.slice(0, 3)).join(', ')
                }
                {' '}from Week {existingSeries.pattern.startWeek} to Week {existingSeries.pattern.endWeek}
              </p>
              <button
                onClick={openRecurrenceModal}
                className="text-blue-600 hover:underline"
                data-testid="edit-recurrence-button"
              >
                Edit recurrence...
              </button>
            </div>
          )}

          {!isRecurring && (
            <div>
              <button
                onClick={openRecurrenceModal}
                className="text-sm text-blue-600 hover:underline"
                data-testid="setup-recurrence-button"
              >
                Set up recurrence...
              </button>
            </div>
          )}
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
            data-testid="delete-block-button"
          >
            Delete
          </button>
        </div>
        <button
          onClick={() => isRecurring ? setApplyScopeAction('save') : handleSave()}
          className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          data-testid="save-block-button"
        >
          Save
        </button>
      </div>

      <ConfirmModal
        open={showDeleteConfirm && !isRecurring}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => handleDelete()}
        title="Delete Block"
        message="Are you sure you want to delete this block from the schedule?"
        confirmText="Delete"
      />

      <Modal open={showDeleteConfirm && isRecurring} onClose={() => setShowDeleteConfirm(false)} title="Delete Recurring Block">
        <div className="space-y-4">
          <p className="text-sm">This block is part of a recurring series. What would you like to delete?</p>
          <div className="space-y-2">
            <button
              onClick={() => handleDelete('this')}
              className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50 text-left"
              data-testid="delete-this-only"
            >
              This instance only
            </button>
            <button
              onClick={() => handleDelete('thisAndFuture')}
              className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50 text-left"
              data-testid="delete-this-and-future"
            >
              This and future occurrences
            </button>
            <button
              onClick={() => handleDelete('all')}
              className="w-full px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 text-left"
              data-testid="delete-all-occurrences"
            >
              All occurrences
            </button>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={applyScopeAction === 'save'} onClose={() => setApplyScopeAction(null)} title="Save Recurring Block">
        <div className="space-y-4">
          <p className="text-sm">This block is part of a recurring series. Apply changes to:</p>
          <div className="space-y-2">
            <button
              onClick={() => { handleSave('this'); setApplyScopeAction(null); }}
              className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50 text-left"
              data-testid="save-this-only"
            >
              This instance only
            </button>
            <button
              onClick={() => { handleSave('thisAndFuture'); setApplyScopeAction(null); }}
              className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50 text-left"
              data-testid="save-this-and-future"
            >
              This and future occurrences
            </button>
            <button
              onClick={() => { handleSave('all'); setApplyScopeAction(null); }}
              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 text-left"
              data-testid="save-all-occurrences"
            >
              All occurrences
            </button>
          </div>
          <button
            onClick={() => setApplyScopeAction(null)}
            className="w-full px-4 py-2 text-sm border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal open={showRecurrence} onClose={() => setShowRecurrence(false)} title={existingSeries ? "Edit Recurrence" : "Set Up Recurrence"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Repeat</label>
            <select
              value={recurrenceType}
              onChange={e => setRecurrenceType(e.target.value as RecurrenceType)}
              className="w-full px-3 py-2 border rounded text-sm"
              data-testid="recurrence-type-select"
            >
              <option value="none">None</option>
              <option value="weekly">Weekly (same day each week)</option>
              <option value="custom">Custom (choose days)</option>
            </select>
          </div>

          {recurrenceType !== 'none' && (
            <>
              {recurrenceType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Days of week</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <label key={day} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={recurrenceDays.includes(day)}
                          onChange={e => {
                            if (e.target.checked) {
                              setRecurrenceDays([...recurrenceDays, day]);
                            } else {
                              setRecurrenceDays(recurrenceDays.filter(d => d !== day));
                            }
                          }}
                          data-testid={`recurrence-day-${day}`}
                        />
                        {day.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Week</label>
                  <select
                    value={recurrenceStartWeek}
                    onChange={e => setRecurrenceStartWeek(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    data-testid="recurrence-start-week"
                  >
                    {Array.from({ length: plan.settings.weeks }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Week</label>
                  <select
                    value={recurrenceEndWeek}
                    onChange={e => setRecurrenceEndWeek(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    data-testid="recurrence-end-week"
                  >
                    {Array.from({ length: plan.settings.weeks }, (_, i) => i + 1).map(w => (
                      <option key={w} value={w}>Week {w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium mb-1">Preview:</p>
                <p className="text-gray-600">
                  {recurrenceType === 'weekly' 
                    ? `Every ${block.day} from Week ${recurrenceStartWeek} to Week ${recurrenceEndWeek}`
                    : `${recurrenceDays.map(d => d.slice(0, 3)).join(', ')} from Week ${recurrenceStartWeek} to Week ${recurrenceEndWeek}`
                  }
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  This will create {recurrenceType === 'weekly' 
                    ? recurrenceEndWeek - recurrenceStartWeek + 1 
                    : (recurrenceEndWeek - recurrenceStartWeek + 1) * recurrenceDays.length
                  } block occurrences.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowRecurrence(false)}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyRecurrence}
              disabled={recurrenceType !== 'none' && recurrenceType === 'custom' && recurrenceDays.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              data-testid="apply-recurrence-button"
            >
              Apply
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
