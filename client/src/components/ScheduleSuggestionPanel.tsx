import { useState } from 'react';
import { Plan, BlockTemplate, Day, DAYS } from '@/state/types';
import { generateScheduleSuggestions, SchedulerResult, SuggestedBlock } from '@/lib/predictiveScheduler';
import { minutesToTimeDisplay } from '@/lib/time';
import { Modal } from './Modal';
import { Loader2, Check, X, AlertTriangle, Sparkles } from 'lucide-react';

interface ScheduleSuggestionPanelProps {
  plan: Plan;
  templates: BlockTemplate[];
  currentWeek: number;
  open: boolean;
  onClose: () => void;
  onAccept: (blocks: SuggestedBlock[]) => void;
}

export function ScheduleSuggestionPanel({
  plan,
  templates,
  currentWeek,
  open,
  onClose,
  onAccept,
}: ScheduleSuggestionPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SchedulerResult | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<'week' | 'all'>('all');

  const handleGenerate = () => {
    setIsGenerating(true);
    
    setTimeout(() => {
      const suggestions = generateScheduleSuggestions(plan, templates, {
        targetWeek: currentWeek,
        totalWeeks: plan.settings.weeks,
        dayStartMinutes: plan.settings.dayStartMinutes,
        dayEndMinutes: plan.settings.dayEndMinutes,
        slotMinutes: plan.settings.slotMinutes,
        distributeAcrossWeeks: scope === 'all',
      });
      
      setResult(suggestions);
      setSelectedBlocks(new Set(suggestions.suggestions.map(s => s.id)));
      setIsGenerating(false);
    }, 500);
  };

  const toggleBlock = (id: string) => {
    const newSelected = new Set(selectedBlocks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBlocks(newSelected);
  };

  const selectAll = () => {
    if (result) {
      setSelectedBlocks(new Set(result.suggestions.map(s => s.id)));
    }
  };

  const deselectAll = () => {
    setSelectedBlocks(new Set());
  };

  const handleAccept = () => {
    if (result) {
      const acceptedBlocks = result.suggestions.filter(s => selectedBlocks.has(s.id));
      onAccept(acceptedBlocks);
      onClose();
    }
  };

  const groupedByWeek = result?.suggestions.reduce((acc, block) => {
    if (!acc[block.week]) acc[block.week] = [];
    acc[block.week].push(block);
    return acc;
  }, {} as Record<number, SuggestedBlock[]>) || {};

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <Modal open={open} onClose={onClose} title="Predictive Schedule Generator">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {!result && !isGenerating && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-purple-900">Smart Schedule Generation</h3>
                  <p className="text-sm text-purple-700 mt-1">
                    This will analyze your Golden Rule budget requirements and generate
                    suggested blocks to fill any gaps in your schedule.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Generation Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScope('week')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'week' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid="scope-week"
                >
                  <div className="font-medium text-sm">Current Week Only</div>
                  <div className="text-xs text-gray-500 mt-1">Fill gaps in Week {currentWeek}</div>
                </button>
                <button
                  onClick={() => setScope('all')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'all' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid="scope-all"
                >
                  <div className="font-medium text-sm">All Weeks</div>
                  <div className="text-xs text-gray-500 mt-1">Distribute across {plan.settings.weeks} weeks</div>
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
              data-testid="generate-suggestions"
            >
              <Sparkles className="w-4 h-4" />
              Generate Schedule Suggestions
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            <p className="text-sm text-gray-600 mt-4">Analyzing budget gaps and generating suggestions...</p>
          </div>
        )}

        {result && !isGenerating && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{result.stats.totalBlocks}</div>
                <div className="text-xs text-gray-500">Blocks Generated</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">{formatDuration(result.stats.totalMinutes)}</div>
                <div className="text-xs text-gray-500">Total Time</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-gray-900">
                  {result.coverage.filter(c => c.gap <= 15).length}/{result.coverage.length}
                </div>
                <div className="text-xs text-gray-500">Budgets Met</div>
              </div>
            </div>

            {result.conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Some budgets could not be fully met:</p>
                    <ul className="mt-1 text-xs space-y-1">
                      {result.conflicts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Suggested Blocks ({result.suggestions.length})</span>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll} className="text-blue-600 hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={deselectAll} className="text-blue-600 hover:underline">Deselect All</button>
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {Object.entries(groupedByWeek).map(([weekNum, blocks]) => (
                  <div key={weekNum}>
                    <div className="bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sticky top-0">
                      Week {weekNum}
                    </div>
                    {blocks.map(block => {
                      const template = templates.find(t => t.id === block.templateId);
                      return (
                        <label
                          key={block.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBlocks.has(block.id)}
                            onChange={() => toggleBlock(block.id)}
                            className="rounded"
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: template?.colorHex || '#6366f1' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {block.bucketLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              {block.day} {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(block.startMinutes + block.durationMinutes)} ({formatDuration(block.durationMinutes)})
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setResult(null); setSelectedBlocks(new Set()); }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                disabled={selectedBlocks.size === 0}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="accept-suggestions"
              >
                <Check className="w-4 h-4" />
                Accept {selectedBlocks.size} Block{selectedBlocks.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
