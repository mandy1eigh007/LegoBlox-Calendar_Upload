import { useState, useRef, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Plan, PlacedBlock, BlockTemplate, Day, DAYS } from '@/state/types';
import { 
  SLOT_HEIGHT_PX, 
  minutesToTimeDisplay, 
  getEndMinutes,
  durationToPixelHeight,
  minutesToPixelOffset
} from '@/lib/time';
import { findTimeConflicts } from '@/lib/collision';

interface WeekGridProps {
  plan: Plan;
  currentWeek: number;
  templates: BlockTemplate[];
  onBlockClick: (block: PlacedBlock) => void;
  onBlockDoubleClick?: (block: PlacedBlock) => void;
  onBlockResize: (blockId: string, newDuration: number) => void;
  selectedBlockId: string | null;
}

interface DayColumnProps {
  day: Day;
  dayBlocks: PlacedBlock[];
  currentWeek: number;
  templatesById: Record<string, BlockTemplate>;
  timeSlots: number[];
  dayStartMinutes: number;
  dayEndMinutes: number;
  onBlockClick: (block: PlacedBlock) => void;
  onBlockDoubleClick?: (block: PlacedBlock) => void;
  onBlockResize: (blockId: string, newDuration: number) => void;
  selectedBlockId: string | null;
}

function DraggablePlacedBlock({ 
  block, 
  template, 
  dayStartMinutes,
  dayEndMinutes,
  onClick,
  onDoubleClick,
  onResize,
  isSelected,
  hasConflict
}: { 
  block: PlacedBlock; 
  template: BlockTemplate | undefined;
  dayStartMinutes: number;
  dayEndMinutes: number;
  onClick: () => void;
  onDoubleClick?: () => void;
  onResize: (newDuration: number) => void;
  isSelected: boolean;
  hasConflict: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: { type: 'placed-block', block },
    disabled: !!block.isLocked,
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);

  const topOffset = minutesToPixelOffset(block.startMinutes, dayStartMinutes);
  const blockHeight = durationToPixelHeight(block.durationMinutes);
  
  const isUnassigned = block.templateId === null;
  const isLocked = !!block.isLocked;
  const title = block.titleOverride || template?.title || 'Unknown';
  const colorHex = isUnassigned ? '#9CA3AF' : (template?.colorHex || '#6B7280');

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    setResizeStartY(e.clientY);
    setInitialDuration(block.durationMinutes);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizeStartY;
      const deltaSlots = Math.round(deltaY / SLOT_HEIGHT_PX);
      const newDuration = Math.max(15, initialDuration + deltaSlots * 15);
      
      const endMinutes = block.startMinutes + newDuration;
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
  }, [isResizing, resizeStartY, initialDuration, block.startMinutes, dayEndMinutes, onResize]);

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-1 right-1 rounded overflow-hidden transition-all ${isDragging ? 'opacity-50 z-50' : ''} ${isSelected ? 'ring-2 ring-blue-600 ring-offset-1' : ''} ${hasConflict ? 'ring-2 ring-red-500' : ''}`}
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
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        className={`px-2 py-1 h-full ${isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {isUnassigned && (
          <p className="text-xs font-bold bg-white/30 px-1 rounded mb-0.5 inline-block">Unassigned</p>
        )}
        {isLocked && (
          <p className="text-[10px] font-semibold bg-black/30 px-1 rounded mb-0.5 inline-block">Locked</p>
        )}
        {block.isAfterHours && (
          <p className="text-[10px] font-semibold bg-black/30 px-1 rounded mb-0.5 inline-block">After hours</p>
        )}
        <p className="text-xs font-medium truncate">{title}</p>
        {blockHeight > 30 && (
          <p className="text-xs opacity-80 truncate">
            {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(getEndMinutes(block.startMinutes, block.durationMinutes))}
          </p>
        )}
        {blockHeight > 45 && block.location && (
          <p className="text-xs opacity-70 truncate">{block.location}</p>
        )}
      </div>
      
      {!isLocked && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-black/20 hover:bg-black/40 transition-colors"
          title="Drag to resize"
        />
      )}
    </div>
  );
}

function DayColumn({ 
  day, 
  dayBlocks,
  currentWeek, 
  templatesById,
  timeSlots,
  dayStartMinutes,
  dayEndMinutes,
  onBlockClick,
  onBlockDoubleClick,
  onBlockResize,
  selectedBlockId
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: { day },
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 relative border-r last:border-r-0 ${isOver ? 'bg-blue-50' : ''}`}
      style={{ minHeight: timeSlots.length * SLOT_HEIGHT_PX }}
    >
      {timeSlots.map((_, idx) => (
        <div
          key={idx}
          className={`border-b ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
          style={{ height: SLOT_HEIGHT_PX }}
        />
      ))}
      
      {dayBlocks.map(block => {
        const template = block.templateId ? templatesById[block.templateId] : undefined;
        const conflicts = findTimeConflicts(
          dayBlocks,
          currentWeek,
          day,
          block.startMinutes,
          block.durationMinutes,
          block.id
        );
        const blockResource = block.resource || block.location;
        const hasConflict = conflicts.length > 0 && !!blockResource &&
          conflicts.some(c => (c.resource || c.location) === blockResource);
        
        return (
          <DraggablePlacedBlock
            key={block.id}
            block={block}
            template={template}
            dayStartMinutes={dayStartMinutes}
            dayEndMinutes={dayEndMinutes}
            onClick={() => onBlockClick(block)}
            onDoubleClick={() => onBlockDoubleClick?.(block)}
            onResize={(newDuration) => onBlockResize(block.id, newDuration)}
            isSelected={selectedBlockId === block.id}
            hasConflict={hasConflict}
          />
        );
      })}
    </div>
  );
}

export function WeekGrid({ plan, currentWeek, templates, onBlockClick, onBlockDoubleClick, onBlockResize, selectedBlockId }: WeekGridProps) {
  const { settings } = plan;
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    const slotMinutes = settings.slotMinutes || 15;
    for (let m = settings.dayStartMinutes; m < settings.dayEndMinutes; m += slotMinutes) {
      slots.push(m);
    }
    return slots;
  }, [settings.dayStartMinutes, settings.dayEndMinutes, settings.slotMinutes]);

  const templatesById = useMemo(() => {
    return templates.reduce((acc, template) => {
      acc[template.id] = template;
      return acc;
    }, {} as Record<string, BlockTemplate>);
  }, [templates]);

  const blocksByDay = useMemo(() => {
    const grouped = DAYS.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {} as Record<Day, PlacedBlock[]>);

    for (const block of plan.blocks) {
      if (block.week !== currentWeek) continue;
      grouped[block.day].push(block);
    }

    return grouped;
  }, [plan.blocks, currentWeek]);

  const activeDays = settings.activeDays && settings.activeDays.length > 0 ? settings.activeDays : DAYS;
  const daysWithBlocks = useMemo(() => {
    const set = new Set<Day>();
    for (const block of plan.blocks) {
      if (block.week === currentWeek) {
        set.add(block.day);
      }
    }
    return set;
  }, [plan.blocks, currentWeek]);

  const enabledDays = DAYS.filter(day => activeDays.includes(day) || daysWithBlocks.has(day));

  return (
    <div className="flex-1 overflow-auto bg-white" data-testid="week-grid">
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
          {timeSlots.map((minutes, idx) => (
            <div
              key={minutes}
              className={`text-xs text-gray-500 text-right pr-2 border-b ${idx % 2 === 0 ? 'border-gray-200' : 'border-gray-100'}`}
              style={{ height: SLOT_HEIGHT_PX, lineHeight: `${SLOT_HEIGHT_PX}px` }}
            >
              {idx % 2 === 0 ? minutesToTimeDisplay(minutes) : ''}
            </div>
          ))}
        </div>

        {enabledDays.map(day => (
          <DayColumn
            key={day}
            day={day}
            dayBlocks={blocksByDay[day]}
            currentWeek={currentWeek}
            templatesById={templatesById}
            timeSlots={timeSlots}
            dayStartMinutes={settings.dayStartMinutes}
            dayEndMinutes={settings.dayEndMinutes}
            onBlockClick={onBlockClick}
            onBlockDoubleClick={onBlockDoubleClick}
            onBlockResize={onBlockResize}
            selectedBlockId={selectedBlockId}
          />
        ))}
      </div>
    </div>
  );
}
