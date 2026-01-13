import { useState, useEffect } from 'react';
import { Plan, BlockTemplate, Day, DAYS, HardDate } from '@/state/types';
import { generateScheduleSuggestions, SchedulerResult, SuggestedBlock } from '@/lib/predictiveScheduler';
import { minutesToTimeDisplay } from '@/lib/time';
import { Modal } from './Modal';
import { Loader2, Check, X, AlertTriangle, Sparkles, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface ScheduleSuggestionPanelProps {
  plan: Plan;
  templates: BlockTemplate[];
  currentWeek: number;
  open: boolean;
  onClose: () => void;
  onAccept: (blocks: SuggestedBlock[]) => void;
  onUpdateHardDates: (hardDates: HardDate[]) => void;
}

export function ScheduleSuggestionPanel({
  plan,
  templates,
  currentWeek,
  open,
  onClose,
  onAccept,
  onUpdateHardDates,
}: ScheduleSuggestionPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<SchedulerResult | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<'week' | 'all'>('all');
  const [showHardDates, setShowHardDates] = useState(false);
  const [hardDates, setHardDates] = useState<HardDate[]>(plan.settings.hardDates || []);
  const [newHardDate, setNewHardDate] = useState<{ week: number; day: Day; description: string }>({
    week: currentWeek,
    day: 'Monday',
    description: ''
  });

  useEffect(() => {
    setHardDates(plan.settings.hardDates || []);
  }, [plan.settings.hardDates]);

  const addHardDate = () => {
    if (!newHardDate.description.trim()) return;
    const id = `hd-${Date.now()}`;
    const updated = [...hardDates, { ...newHardDate, id }];
    setHardDates(updated);
    onUpdateHardDates(updated);
    setNewHardDate({ week: currentWeek, day: 'Monday', description: '' });
  };

  const removeHardDate = (id: string) => {
    const updated = hardDates.filter(hd => hd.id !== id);
    setHardDates(updated);
    onUpdateHardDates(updated);
  };

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
        hardDates: hardDates.map(hd => ({ week: hd.week, day: hd.day })),
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
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <h3 className="font-medium text-foreground">Smart Schedule Generation</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will analyze your Golden Rule budget requirements and generate
                    suggested blocks to fill any gaps in your schedule.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Generation Scope</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setScope('week')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'week' ? 'border-accent bg-accent/20' : 'border-border hover:border-muted-foreground'
                  }`}
                  data-testid="scope-week"
                >
                  <div className="font-medium text-sm text-foreground">Current Week Only</div>
                  <div className="text-xs text-muted-foreground mt-1">Fill gaps in Week {currentWeek}</div>
                </button>
                <button
                  onClick={() => setScope('all')}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    scope === 'all' ? 'border-accent bg-accent/20' : 'border-border hover:border-muted-foreground'
                  }`}
                  data-testid="scope-all"
                >
                  <div className="font-medium text-sm text-foreground">All Weeks</div>
                  <div className="text-xs text-muted-foreground mt-1">Distribute across {plan.settings.weeks} weeks</div>
                </button>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowHardDates(!showHardDates)}
                className="w-full px-4 py-3 flex items-center justify-between text-left bg-secondary/30 hover:bg-secondary/50 transition-colors"
                data-testid="toggle-hard-dates"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-accent" />
                  <span className="font-medium text-sm text-foreground">Fixed Dates (Off Days)</span>
                  {hardDates.length > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-accent/20 text-accent rounded-full">
                      {hardDates.length}
                    </span>
                  )}
                </div>
                {showHardDates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              
              {showHardDates && (
                <div className="p-4 space-y-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Add days that should be skipped during schedule generation (holidays, field trips, etc.)
                  </p>
                  
                  <div className="flex gap-2">
                    <select
                      value={newHardDate.week}
                      onChange={e => setNewHardDate({ ...newHardDate, week: parseInt(e.target.value) })}
                      className="px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground"
                    >
                      {Array.from({ length: plan.settings.weeks }, (_, i) => i + 1).map(w => (
                        <option key={w} value={w}>Wk {w}</option>
                      ))}
                    </select>
                    <select
                      value={newHardDate.day}
                      onChange={e => setNewHardDate({ ...newHardDate, day: e.target.value as Day })}
                      className="px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Description (e.g., Holiday)"
                      value={newHardDate.description}
                      onChange={e => setNewHardDate({ ...newHardDate, description: e.target.value })}
                      className="flex-1 px-2 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={addHardDate}
                      disabled={!newHardDate.description.trim()}
                      className="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition-all"
                      data-testid="add-hard-date"
                    >
                      Add
                    </button>
                  </div>
                  
                  {hardDates.length > 0 && (
                    <div className="space-y-1">
                      {hardDates.map(hd => (
                        <div key={hd.id} className="flex items-center justify-between px-3 py-2 bg-secondary/30 rounded-lg">
                          <span className="text-sm text-foreground">
                            <span className="font-medium">Wk {hd.week}, {hd.day}:</span> {hd.description}
                          </span>
                          <button
                            onClick={() => removeHardDate(hd.id)}
                            className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            data-testid={`remove-hard-date-${hd.id}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              className="w-full px-4 py-3 bg-accent text-accent-foreground rounded-lg hover:opacity-90 glow-accent flex items-center justify-center gap-2 transition-all"
              data-testid="generate-suggestions"
            >
              <Sparkles className="w-4 h-4" />
              Generate Schedule Suggestions
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent" />
            <p className="text-sm text-muted-foreground mt-4">Analyzing budget gaps and generating suggestions...</p>
          </div>
        )}

        {result && !isGenerating && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">{result.stats.totalBlocks}</div>
                <div className="text-xs text-muted-foreground">Blocks Generated</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">{formatDuration(result.stats.totalMinutes)}</div>
                <div className="text-xs text-muted-foreground">Total Time</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="text-2xl font-bold text-foreground">
                  {result.coverage.filter(c => c.gap <= 15).length}/{result.coverage.length}
                </div>
                <div className="text-xs text-muted-foreground">Budgets Met</div>
              </div>
            </div>

            {result.conflicts.length > 0 && (
              <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div className="text-sm text-amber-300">
                    <p className="font-medium">Some budgets could not be fully met:</p>
                    <ul className="mt-1 text-xs text-amber-400 space-y-1">
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
                <span className="text-sm font-medium text-foreground">Suggested Blocks ({result.suggestions.length})</span>
                <div className="flex gap-2 text-xs">
                  <button onClick={selectAll} className="text-accent hover:underline">Select All</button>
                  <span className="text-muted-foreground">|</span>
                  <button onClick={deselectAll} className="text-accent hover:underline">Deselect All</button>
                </div>
              </div>

              <div className="border border-border rounded-lg max-h-64 overflow-y-auto">
                {Object.entries(groupedByWeek).map(([weekNum, blocks]) => (
                  <div key={weekNum}>
                    <div className="bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground sticky top-0">
                      Week {weekNum}
                    </div>
                    {blocks.map(block => {
                      const template = templates.find(t => t.id === block.templateId);
                      return (
                        <label
                          key={block.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/30 cursor-pointer border-b border-border last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBlocks.has(block.id)}
                            onChange={() => toggleBlock(block.id)}
                            className="rounded accent-primary"
                          />
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: template?.colorHex || '#6366f1' }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {block.bucketLabel}
                            </div>
                            <div className="text-xs text-muted-foreground">
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
                className="flex-1 px-4 py-2 border border-border rounded-lg text-foreground hover:bg-secondary/50 transition-all"
              >
                Regenerate
              </button>
              <button
                onClick={handleAccept}
                disabled={selectedBlocks.size === 0}
                className="flex-1 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 glow-accent disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
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
