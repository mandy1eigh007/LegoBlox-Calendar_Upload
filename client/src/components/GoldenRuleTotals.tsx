import { Plan, BlockTemplate } from '@/state/types';
import { calculateGoldenRuleSummary } from '@/lib/goldenRule';
import { formatDuration, formatMinutesAsHoursMinutes } from '@/lib/time';

interface GoldenRuleTotalsProps {
  plan: Plan;
  templates: BlockTemplate[];
  onShowUnassigned?: () => void;
}

export function GoldenRuleTotals({ plan, templates, onShowUnassigned }: GoldenRuleTotalsProps) {
  const summary = calculateGoldenRuleSummary(plan, templates);
  const totals = summary.buckets;
  
  const activeTopics = totals.filter(t => t.scheduled > 0 || t.budget > 0);

  return (
    <div className="h-full flex flex-col bg-white border-l">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Golden Rule Totals</h3>
        <p className="text-xs text-gray-500 mt-1">Scheduled / Budget</p>
      </div>

      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        {activeTopics.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No blocks scheduled yet
          </p>
        ) : (
          <div className="space-y-1">
            {activeTopics.map(item => (
              <div
                key={item.id}
                className={`p-2 rounded text-xs transition-all ${
                  item.isFlexible
                    ? 'bg-indigo-50 border border-indigo-200'
                    : item.met && item.status !== 'over'
                      ? 'bg-green-100 border-2 border-green-500 shadow-sm'
                      : item.status === 'over' 
                        ? 'bg-red-50 border border-red-200' 
                        : item.status === 'on-target' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-gray-50 border border-gray-200'
                }`}
                data-testid={`golden-rule-${item.id}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="font-medium truncate flex-1" title={item.label}>
                    {item.label}
                  </p>
                  {item.isFlexible ? (
                    <span className="flex-shrink-0 bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-xs" title="Flexible target">
                      Flexible
                    </span>
                  ) : item.met ? (
                    <span className="flex-shrink-0 bg-green-500 text-white rounded-full px-1.5 py-0.5 text-xs" title="Hours met!">
                      Done
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono">
                    {formatDuration(item.scheduled)} / {formatDuration(item.budget)}
                  </span>
                  <span className={`${
                    item.isFlexible
                      ? 'text-indigo-600'
                      : item.status === 'over' 
                      ? 'text-red-600' 
                      : item.met 
                        ? 'text-green-700 font-semibold'
                        : item.status === 'on-target' 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                  }`}>
                    {item.isFlexible && 'Tracked only'}
                    {item.status === 'over' && `Over ${formatMinutesAsHoursMinutes(item.difference)}`}
                    {item.status === 'under' && `Under ${formatMinutesAsHoursMinutes(Math.abs(item.difference))}`}
                    {item.status === 'on-target' && (item.met ? 'Complete!' : 'On target')}
                  </span>
                </div>
                <div className="text-gray-400 mt-0.5">
                  {item.scheduled}m / {item.budget}m
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {summary.unassignedCount > 0 && (
        <div className="p-3 border-t bg-amber-50">
          <div className="text-xs text-amber-800">
            <p className="font-medium">Unassigned (not counting)</p>
            <p className="font-mono">{formatDuration(summary.unassignedMinutes)} ({summary.unassignedCount} block{summary.unassignedCount !== 1 ? 's' : ''})</p>
            {onShowUnassigned && (
              <button
                onClick={onShowUnassigned}
                className="mt-1 text-amber-700 underline hover:text-amber-900"
                data-testid="review-unassigned-button"
              >
                Review and assign
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-3 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Status Legend:</p>
          <p className="text-indigo-600">Flexible: tracked only (no target)</p>
          <p className="flex items-center gap-1">
            <span className="inline-flex bg-green-500 text-white rounded-full px-1.5 py-0.5 text-xs">Done</span>
            <span className="text-green-700">Complete: hours met</span>
          </p>
          <p className="text-green-600">On target: within +/- 15 min</p>
          <p className="text-red-600">Over: exceeds budget by 15+ min</p>
          <p className="text-gray-500">Under: below budget by 15+ min</p>
        </div>
      </div>
    </div>
  );
}
