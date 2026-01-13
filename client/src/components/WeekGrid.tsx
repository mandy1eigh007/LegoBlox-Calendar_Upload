import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Plan, PlacedBlock, BlockTemplate, Day, DAYS } from '@/state/types';
import { generateTimeSlots, formatTimeDisplay, timeToMinutes, getEndTime, minutesToTime } from '@/lib/time';

interface WeekGridProps {
  plan: Plan;
  currentWeek: number;
  templates: BlockTemplate[];
  onBlockClick: (block: PlacedBlock) => void;
  onBlockResize: (blockId: string, newDuration: number) => void;
  selectedBlockId: string | null;
}

interface DayColumnProps {
  day: Day;
  dayIndex: number;
  plan: Plan;
  currentWeek: number;
  templates: BlockTemplate[];
  timeSlots: string[];
  slotHeight: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  onBlockClick: (block: PlacedBlock) => void;
  onBlockResize: (blockId: string, newDuration: number) => void;
  selectedBlockId: string | null;
}

function DraggablePlacedBlock({ 
  block, 
  template, 
  slotHeight, 
  dayStartMinutes,
  dayEndMinutes,
  onClick,
  onResize,
  isSelected
}: { 
  block: PlacedBlock; 
  template: BlockTemplate | undefined;
  slotHeight: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  onClick: () => void;
  onResize: (newDuration: number) => void;
  isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { type: 'placed-block', block },
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);
  const resizeRef = useRef<HTMLDivElement>(null);

  const startMinutes = timeToMinutes(block.startTime);
  const topOffset = ((startMinutes - dayStartMinutes) / 15) * slotHeight;
  const blockHeight = (block.durationMin / 15) * slotHeight;
  
  const title = block.titleOverride || template?.title || 'Unknown';
  const colorHex = template?.colorHex || '#6B7280';

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStartY(e.clientY);
    setInitialDuration(block.durationMin);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY;
      const deltaSlots = Math.round(deltaY / slotHeight);
      const newDuration = Math.max(15, initialDuration + deltaSlots * 15);
      
      const endMinutes = startMinutes + newDuration;
      if (endMinutes <= dayEndMinutes) {
        onResize(newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartY, initialDuration, slotHeight, startMinutes, dayEndMinutes, onResize]);

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-1 right-1 rounded overflow-hidden transition-all ${isDragging ? 'opacity-50 z-50' : ''} ${isSelected ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}
      style={{
        top: `${topOffset}px`,
        height: `${blockHeight - 2}px`,
        backgroundColor: colorHex,
        color: 'white',
      }}
      data-testid={`placed-block-${block.id}`}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="px-2 py-1 cursor-grab active:cursor-grabbing h-full"
      >
        <p className="text-xs font-medium truncate">{title}</p>
        {blockHeight > 30 && (
          <p className="text-xs opacity-80 truncate">
            {formatTimeDisplay(block.startTime)} - {formatTimeDisplay(getEndTime(block.startTime, block.durationMin))}
          </p>
        )}
        {blockHeight > 45 && (
          <p className="text-xs opacity-70">{block.durationMin}m</p>
        )}
      </div>
      
      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-black/20 hover:bg-black/40 transition-colors"
        title="Drag to resize"
      />
    </div>
  );
}

function DayColumn({ 
  day, 
  dayIndex,
  plan, 
  currentWeek, 
  templates, 
  timeSlots, 
  slotHeight,
  dayStartMinutes,
  dayEndMinutes,
  onBlockClick,
  onBlockResize,
  selectedBlockId
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: { day, dayIndex },
  });

  const dayBlocks = plan.blocks.filter(b => b.week === currentWeek && b.day === day);
  const lunchStart = plan.settings.lunchEnabled ? timeToMinutes(plan.settings.lunchStartTime) : null;
  const lunchEnd = lunchStart ? lunchStart + plan.settings.lunchDurationMin : null;

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 relative border-r last:border-r-0 ${isOver ? 'bg-blue-50' : ''}`}
      style={{ minHeight: timeSlots.length * slotHeight }}
    >
      {plan.settings.lunchEnabled && lunchStart !== null && lunchEnd !== null && 
       lunchStart >= dayStartMinutes && lunchStart < dayEndMinutes && (
        <div
          className="absolute left-0 right-0 bg-gray-100 border-y border-gray-200 pointer-events-none z-0"
          style={{
            top: ((lunchStart - dayStartMinutes) / 15) * slotHeight,
            height: (Math.min(lunchEnd, dayEndMinutes) - lunchStart) / 15 * slotHeight,
          }}
        >
          <span className="text-xs text-gray-400 px-1">Lunch</span>
        </div>
      )}
      
      {timeSlots.map((time, idx) => (
        <div
          key={idx}
          className={`border-b ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
          style={{ height: slotHeight }}
        />
      ))}
      
      {dayBlocks.map(block => {
        const template = templates.find(t => t.id === block.templateId);
        return (
          <DraggablePlacedBlock
            key={block.id}
            block={block}
            template={template}
            slotHeight={slotHeight}
            dayStartMinutes={dayStartMinutes}
            dayEndMinutes={dayEndMinutes}
            onClick={() => onBlockClick(block)}
            onResize={(newDuration) => onBlockResize(block.id, newDuration)}
            isSelected={selectedBlockId === block.id}
          />
        );
      })}
    </div>
  );
}

export function WeekGrid({ plan, currentWeek, templates, onBlockClick, onBlockResize, selectedBlockId }: WeekGridProps) {
  const { settings } = plan;
  const timeSlots = generateTimeSlots(settings.dayStartTime, settings.dayEndTime, settings.slotMin);
  const slotHeight = 24;
  const dayStartMinutes = timeToMinutes(settings.dayStartTime);
  const dayEndMinutes = timeToMinutes(settings.dayEndTime);

  const enabledDays = DAYS.filter(day => settings.enabledDays.includes(day));

  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="flex">
          <div className="w-20 flex-shrink-0 border-r bg-gray-50" />
          {enabledDays.map(day => (
            <div
              key={day}
              className="flex-1 px-2 py-2 text-center text-sm font-medium border-r last:border-r-0 bg-gray-50"
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        <div className="w-20 flex-shrink-0 border-r bg-gray-50">
          {timeSlots.map((time, idx) => (
            <div
              key={time}
              className={`text-xs text-gray-500 text-right pr-2 border-b ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
              style={{ height: slotHeight, lineHeight: `${slotHeight}px` }}
            >
              {idx % 2 === 0 ? formatTimeDisplay(time) : ''}
            </div>
          ))}
        </div>

        {enabledDays.map((day, dayIndex) => (
          <DayColumn
            key={day}
            day={day}
            dayIndex={dayIndex}
            plan={plan}
            currentWeek={currentWeek}
            templates={templates}
            timeSlots={timeSlots}
            slotHeight={slotHeight}
            dayStartMinutes={dayStartMinutes}
            dayEndMinutes={dayEndMinutes}
            onBlockClick={onBlockClick}
            onBlockResize={onBlockResize}
            selectedBlockId={selectedBlockId}
          />
        ))}
      </div>
    </div>
  );
}
