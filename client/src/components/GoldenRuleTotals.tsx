import { Plan, BlockTemplate } from '@/state/types';
import { calculateTopicTotals } from '@/lib/goldenRule';
import { formatDuration } from '@/lib/time';

interface GoldenRuleTotalsProps {
  plan: Plan;
  templates: BlockTemplate[];
}

export function GoldenRuleTotals({ plan, templates }: GoldenRuleTotalsProps) {
  const totals = calculateTopicTotals(plan, templates);
  
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
                key={item.key}
                className={`p-2 rounded text-xs ${
                  item.status === 'over' 
                    ? 'bg-red-50 border border-red-200' 
                    : item.status === 'on-target' 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-gray-50 border border-gray-200'
                }`}
                data-testid={`golden-rule-${item.key}`}
              >
                <p className="font-medium truncate" title={item.label}>
                  {item.label}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono">
                    {formatDuration(item.scheduled)} / {formatDuration(item.budget)}
                  </span>
                  <span className={`${
                    item.status === 'over' 
                      ? 'text-red-600' 
                      : item.status === 'on-target' 
                        ? 'text-green-600' 
                        : 'text-gray-500'
                  }`}>
                    {item.status === 'over' && `Over by ${item.difference}m`}
                    {item.status === 'under' && `Under by ${Math.abs(item.difference)}m`}
                    {item.status === 'on-target' && 'On target'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t bg-gray-50">
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Status Legend:</p>
          <p className="text-green-600">On target: within +/- 15 min</p>
          <p className="text-red-600">Over: exceeds budget by more than 15 min</p>
          <p className="text-gray-500">Under: below budget by more than 15 min</p>
        </div>
      </div>
    </div>
  );
}
