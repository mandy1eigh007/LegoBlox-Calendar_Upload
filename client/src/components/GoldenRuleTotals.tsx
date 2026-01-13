import { Plan, BlockTemplate } from '@/state/types';
import { calculateGoldenRuleTotals } from '@/lib/goldenRule';
import { formatDuration, formatMinutesAsHoursMinutes } from '@/lib/time';
import { Check } from 'lucide-react';

interface GoldenRuleTotalsProps {
  plan: Plan;
  templates: BlockTemplate[];
}

export function GoldenRuleTotals({ plan, templates }: GoldenRuleTotalsProps) {
  const totals = calculateGoldenRuleTotals(plan, templates);
  
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
                  item.met && item.status !== 'over'
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
                  {item.met && (
                    <span className="flex-shrink-0 bg-green-500 text-white rounded-full p-0.5" title="Hours met!">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono">
                    {formatDuration(item.scheduled)} / {formatDuration(item.budget)}
                  </span>
                  <span className={`${
                    item.status === 'over' 
                      ? 'text-red-600' 
                      : item.met 
                        ? 'text-green-700 font-semibold'
                        : item.status === 'on-target' 
                          ? 'text-green-600' 
                          : 'text-gray-500'
                  }`}>
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

      <div className="p-3 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Status Legend:</p>
          <p className="flex items-center gap-1">
            <span className="inline-flex bg-green-500 text-white rounded-full p-0.5"><Check className="w-2.5 h-2.5" /></span>
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
