import { useState } from 'react';
import { Plan, BlockTemplate, DAYS } from '@/state/types';
import { 
  minutesToTimeDisplay, 
  getEndMinutes,
  SLOT_HEIGHT_PX,
  formatDuration,
  formatMinutesAsHoursMinutes
} from '@/lib/time';
import { calculateGoldenRuleTotals } from '@/lib/goldenRule';

interface PrintViewProps {
  plan: Plan;
  currentWeek: number;
  templates: BlockTemplate[];
  onClose: () => void;
}

export function PrintView({ plan, currentWeek: initialWeek, templates, onClose }: PrintViewProps) {
  const [currentWeek, setCurrentWeek] = useState(initialWeek);
  const { settings } = plan;
  
  const timeSlots: number[] = [];
  for (let m = settings.dayStartMinutes; m < settings.dayEndMinutes; m += 15) {
    timeSlots.push(m);
  }
  
  const slotHeight = 20;

  const totals = calculateGoldenRuleTotals(plan, templates);
  const activeTopics = totals.filter(t => t.scheduled > 0 || t.budget > 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print-schedule">
      <div className="no-print sticky top-0 bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold">{plan.settings.name} - Week {currentWeek}</h2>
          <select
            className="px-3 py-1 border rounded text-sm"
            value={currentWeek}
            onChange={(e) => setCurrentWeek(parseInt(e.target.value))}
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

        <div className="print-grid border rounded overflow-hidden mb-8">
          <div className="print-grid-header flex border-b bg-gray-100">
            <div className="w-20 flex-shrink-0 p-2 text-sm font-medium border-r">Time</div>
            {DAYS.map(day => (
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
              {timeSlots.map((minutes, idx) => (
                <div
                  key={minutes}
                  className="text-xs text-gray-600 text-right pr-2 border-b"
                  style={{ height: slotHeight }}
                >
                  {idx % 2 === 0 ? minutesToTimeDisplay(minutes) : ''}
                </div>
              ))}
            </div>

            {DAYS.map(day => {
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
                    const topOffset = ((block.startMinutes - settings.dayStartMinutes) / 15) * slotHeight;
                    const blockHeight = (block.durationMinutes / 15) * slotHeight;
                    const title = block.titleOverride || template?.title || 'Unknown';
                    
                    return (
                      <div
                        key={block.id}
                        className="print-block absolute left-0 right-0 mx-1 rounded border border-gray-400 bg-gray-200 px-1 overflow-hidden"
                        style={{
                          top: `${topOffset}px`,
                          height: `${blockHeight - 1}px`,
                        }}
                      >
                        <p className="print-block-title text-xs font-medium truncate">{title}</p>
                        {blockHeight > 25 && (
                          <p className="print-block-time text-xs text-gray-600 truncate">
                            {minutesToTimeDisplay(block.startMinutes)}-{minutesToTimeDisplay(getEndMinutes(block.startMinutes, block.durationMinutes))}
                          </p>
                        )}
                        {blockHeight > 40 && settings.showNotesOnPrint && block.notes && (
                          <p className="print-block-notes text-xs text-gray-500 truncate">{block.notes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="border rounded p-4">
          <h3 className="font-semibold mb-3">Golden Rule Totals Summary</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {activeTopics.map(item => (
              <div 
                key={item.id}
                className={`p-2 rounded ${
                  item.status === 'over' ? 'bg-red-50' : 
                  item.status === 'on-target' ? 'bg-green-50' : 
                  'bg-gray-50'
                }`}
              >
                <span className="font-medium">{item.label}:</span>{' '}
                <span>{formatDuration(item.scheduled)} / {formatDuration(item.budget)}</span>
                <span className={`ml-2 ${
                  item.status === 'over' ? 'text-red-600' : 
                  item.status === 'on-target' ? 'text-green-600' : 
                  'text-gray-500'
                }`}>
                  ({item.status === 'over' ? `Over ${formatMinutesAsHoursMinutes(item.difference)}` : 
                    item.status === 'under' ? `Under ${formatMinutesAsHoursMinutes(Math.abs(item.difference))}` : 
                    'On target'})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
          @page { size: landscape; margin: 0.5in; }

          .print-schedule { background: white !important; }
          .print-schedule * { color: #000 !important; }
          .print-schedule .print-grid,
          .print-schedule .print-grid * { border-color: #000 !important; }
          .print-schedule .print-grid-header { background: #fff !important; }
          .print-schedule .print-block {
            background: #fff !important;
            border: 1px solid #000 !important;
            opacity: 1 !important;
            filter: none !important;
          }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
