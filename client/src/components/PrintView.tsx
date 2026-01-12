import { Plan, BlockTemplate, DAYS } from '@/state/types';
import { generateTimeSlots, formatTimeDisplay, timeToMinutes, getEndTime } from '@/lib/time';

interface PrintViewProps {
  plan: Plan;
  currentWeek: number;
  templates: BlockTemplate[];
  onClose: () => void;
}

export function PrintView({ plan, currentWeek, templates, onClose }: PrintViewProps) {
  const { settings } = plan;
  const timeSlots = generateTimeSlots(settings.dayStartTime, settings.dayEndTime, settings.slotMin);
  const enabledDays = DAYS.filter(day => settings.enabledDays.includes(day));
  const dayStartMinutes = timeToMinutes(settings.dayStartTime);
  const slotHeight = 20;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <div className="no-print sticky top-0 bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold">{plan.settings.name} - Week {currentWeek}</h2>
          <select
            className="px-3 py-1 border rounded text-sm"
            value={currentWeek}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set('printWeek', e.target.value);
              window.history.replaceState({}, '', url);
              window.location.reload();
            }}
            data-testid="print-week-select"
          >
            {Array.from({ length: settings.weeks }, (_, i) => i + 1).map(week => (
              <option key={week} value={week}>Week {week}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            data-testid="print-button"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            data-testid="close-print-view"
          >
            Close
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="print-only mb-4">
          <h1 className="text-xl font-bold">{plan.settings.name}</h1>
          <p className="text-sm text-gray-600">Week {currentWeek}</p>
        </div>

        <div className="border rounded overflow-hidden">
          <div className="flex border-b bg-gray-100">
            <div className="w-20 flex-shrink-0 p-2 text-sm font-medium border-r">Time</div>
            {enabledDays.map(day => (
              <div
                key={day}
                className="flex-1 p-2 text-sm font-medium text-center border-r last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="w-20 flex-shrink-0 border-r">
              {timeSlots.map((time, idx) => (
                <div
                  key={time}
                  className="text-xs text-gray-600 text-right pr-2 border-b"
                  style={{ height: slotHeight }}
                >
                  {idx % 4 === 0 ? formatTimeDisplay(time) : ''}
                </div>
              ))}
            </div>

            {enabledDays.map(day => {
              const dayBlocks = plan.blocks.filter(b => b.week === currentWeek && b.day === day);
              
              return (
                <div
                  key={day}
                  className="flex-1 relative border-r last:border-r-0"
                  style={{ minHeight: timeSlots.length * slotHeight }}
                >
                  {timeSlots.map((_, idx) => (
                    <div
                      key={idx}
                      className="border-b"
                      style={{ height: slotHeight }}
                    />
                  ))}
                  
                  {dayBlocks.map(block => {
                    const template = templates.find(t => t.id === block.templateId);
                    const startMinutes = timeToMinutes(block.startTime);
                    const topOffset = ((startMinutes - dayStartMinutes) / 15) * slotHeight;
                    const blockHeight = (block.durationMin / 15) * slotHeight;
                    const title = block.titleOverride || template?.title || 'Unknown';
                    
                    return (
                      <div
                        key={block.id}
                        className="absolute left-0 right-0 mx-1 rounded border border-gray-400 bg-gray-200 px-1 overflow-hidden"
                        style={{
                          top: `${topOffset}px`,
                          height: `${blockHeight - 1}px`,
                        }}
                      >
                        <p className="text-xs font-medium truncate">{title}</p>
                        {blockHeight > 25 && (
                          <p className="text-xs text-gray-600 truncate">
                            {formatTimeDisplay(block.startTime)}-{formatTimeDisplay(getEndTime(block.startTime, block.durationMin))}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          @page { size: landscape; margin: 0.5in; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
