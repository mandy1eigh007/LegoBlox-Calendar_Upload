import { useParams } from 'wouter';
import { useStore } from '@/state/store';
import { Plan, DAYS, BlockTemplate, DEFAULT_RESOURCES } from '@/state/types';
import { minutesToTimeDisplay, getEndMinutes, durationToPixelHeight, minutesToPixelOffset, SLOT_HEIGHT_PX } from '@/lib/time';
import { useEffect, useMemo, useState } from 'react';
import { findAlternativeResource } from '@/lib/calendarCompare';

interface ReadOnlyBlockProps {
  block: Plan['blocks'][0];
  template: BlockTemplate | undefined;
  dayStartMinutes: number;
}

function ReadOnlyBlock({ block, template, dayStartMinutes }: ReadOnlyBlockProps) {
  const topOffset = minutesToPixelOffset(block.startMinutes, dayStartMinutes);
  const blockHeight = durationToPixelHeight(block.durationMinutes);
  
  const isUnassigned = block.templateId === null;
  const title = block.titleOverride || template?.title || 'Event';
  const colorHex = isUnassigned ? '#9CA3AF' : (template?.colorHex || '#6B7280');

  return (
    <div
      className="absolute left-1 right-1 rounded overflow-hidden"
      style={{
        top: `${topOffset}px`,
        height: `${blockHeight - 2}px`,
        backgroundColor: colorHex,
        color: 'white',
      }}
      data-testid={`student-block-${block.id}`}
    >
      <div className="px-2 py-1 h-full">
        {isUnassigned && (
          <p className="text-xs font-bold bg-white/30 px-1 rounded mb-0.5 inline-block">Unassigned</p>
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
    </div>
  );
}

export function StudentView() {
  const { publicId } = useParams<{ publicId: string }>();
  const { state } = useStore();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [remotePlan, setRemotePlan] = useState<Plan | null>(null);
  const [remoteTemplates, setRemoteTemplates] = useState<BlockTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const localPlan = state.plans.find(p => p.publicId === publicId && p.isPublished);

  useEffect(() => {
    let active = true;
    if (!publicId) return;
    setRemotePlan(null);
    setRemoteTemplates([]);
    setIsLoading(true);
    setLoadError(null);
    fetch(`/api/published/${publicId}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(data => {
        if (!active) return;
        const plan = data?.plan ?? data;
        const templates = Array.isArray(data?.templates) ? data.templates : [];
        setRemotePlan(plan || null);
        setRemoteTemplates(templates);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        if (!localPlan) {
          setLoadError('Schedule not found or no longer published.');
        }
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [publicId, localPlan]);

  const plan = remotePlan ?? localPlan;
  const usingRemote = !!remotePlan;
  const templates = usingRemote ? (remoteTemplates.length > 0 ? remoteTemplates : state.templates) : state.templates;

  const getBlockTitle = (block: Plan['blocks'][0]) => {
    if (block.titleOverride) return block.titleOverride;
    const template = templates.find(t => t.id === block.templateId);
    return template?.title || 'Event';
  };

  const partnerBlocks = useMemo(() => {
    if (!plan) return [];
    const hasPartnerInfo = (block: Plan['blocks'][0]) =>
      !!(block.partnerOrg || block.partnerContact || block.partnerEmail || block.partnerPhone || block.partnerAddress || block.partnerPPE || block.partnerParking);
    const dayOrder = new Map(DAYS.map((d, idx) => [d, idx]));
    return plan.blocks
      .filter(block => block.week === currentWeek && hasPartnerInfo(block))
      .sort((a, b) => {
        const dayDiff = (dayOrder.get(a.day) ?? 0) - (dayOrder.get(b.day) ?? 0);
        if (dayDiff !== 0) return dayDiff;
        return a.startMinutes - b.startMinutes;
      });
  }, [plan, currentWeek, templates]);

  const resourceConflicts = useMemo(() => {
    if (!plan) return [];
    const conflicts: Array<{
      id: string;
      resource: string;
      day: string;
      startMinutes: number;
      endMinutes: number;
      blockA: Plan['blocks'][0];
      blockB: Plan['blocks'][0];
      suggestion?: { blockId: string; resource: string };
    }> = [];

    const blocks = plan.blocks.filter(b => b.week === currentWeek);
    const availableResources = plan.settings.resources?.length
      ? [...plan.settings.resources]
      : [...DEFAULT_RESOURCES];

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const a = blocks[i];
        const b = blocks[j];
        const resourceA = a.resource || a.location;
        const resourceB = b.resource || b.location;
        if (!resourceA || !resourceB) continue;
        if (resourceA !== resourceB) continue;
        if (a.day !== b.day) continue;
        const aEnd = a.startMinutes + a.durationMinutes;
        const bEnd = b.startMinutes + b.durationMinutes;
        if (a.startMinutes >= bEnd || b.startMinutes >= aEnd) continue;

        const conflictStart = Math.max(a.startMinutes, b.startMinutes);
        const conflictEnd = Math.min(aEnd, bEnd);
        let suggestion: { blockId: string; resource: string } | undefined;
        const altA = findAlternativeResource(a, plan, availableResources);
        if (altA) {
          suggestion = { blockId: a.id, resource: altA };
        } else {
          const altB = findAlternativeResource(b, plan, availableResources);
          if (altB) suggestion = { blockId: b.id, resource: altB };
        }

        conflicts.push({
          id: `${a.id}-${b.id}`,
          resource: resourceA,
          day: a.day,
          startMinutes: conflictStart,
          endMinutes: conflictEnd,
          blockA: a,
          blockB: b,
          suggestion,
        });
      }
    }

    return conflicts;
  }, [plan, currentWeek]);

  useEffect(() => {
    if (plan) {
      setCurrentWeek(1);
    }
  }, [plan?.id]);

  if (isLoading && !localPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-sm border max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Loading Schedule...</h1>
          <p className="text-gray-500">Fetching the published plan. Please wait.</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Schedule Not Available</h1>
          <p className="text-gray-500 mb-4">
            {loadError || 'This schedule is not available right now.'}
          </p>
          <div className="text-left text-sm text-gray-600 bg-gray-50 p-4 rounded">
            <p className="font-medium mb-2">To view this schedule, ask your instructor to:</p>
            <p className="mb-1">1. Republish the schedule from the builder</p>
            <p className="mb-1">2. Share the updated student link</p>
            <p>3. Or export a JSON backup and share it with you</p>
          </div>
        </div>
      </div>
    );
  }

  const { settings } = plan;
  const timeSlots: number[] = [];
  for (let m = settings.dayStartMinutes; m < settings.dayEndMinutes; m += 15) {
    timeSlots.push(m);
  }

  const formattedDate = plan.updatedAt 
    ? new Date(plan.updatedAt).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{settings.name}</h1>
            <p className="text-sm text-gray-500">Updated: {formattedDate}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                data-testid="prev-week-student"
              >
                Previous
              </button>
              <span className="text-sm font-medium px-3">Week {currentWeek} of {settings.weeks}</span>
              <button
                onClick={() => setCurrentWeek(Math.min(settings.weeks, currentWeek + 1))}
                disabled={currentWeek === settings.weeks}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                data-testid="next-week-student"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {partnerBlocks.length > 0 && (
          <section className="mb-6 bg-white rounded-lg border shadow-sm p-4" data-testid="student-partner-section">
            <h2 className="text-lg font-semibold mb-3">Partner Visits & Contacts</h2>
            <div className="space-y-3">
              {partnerBlocks.map(block => (
                <div key={block.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{getBlockTitle(block)}</p>
                      <p className="text-gray-600">
                        {block.day} · {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(getEndMinutes(block.startMinutes, block.durationMinutes))}
                        {block.location ? ` · ${block.location}` : ''}
                      </p>
                    </div>
                    {block.partnerOrg && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded">{block.partnerOrg}</span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700">
                    {block.partnerContact && <div><span className="font-medium">Contact:</span> {block.partnerContact}</div>}
                    {block.partnerEmail && <div><span className="font-medium">Email:</span> {block.partnerEmail}</div>}
                    {block.partnerPhone && <div><span className="font-medium">Phone:</span> {block.partnerPhone}</div>}
                    {block.partnerAddress && <div><span className="font-medium">Address:</span> {block.partnerAddress}</div>}
                    {block.partnerPPE && <div><span className="font-medium">PPE:</span> {block.partnerPPE}</div>}
                    {block.partnerParking && <div><span className="font-medium">Parking:</span> {block.partnerParking}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {resourceConflicts.length > 0 && (
          <section className="mb-6 bg-white rounded-lg border shadow-sm p-4" data-testid="student-conflict-section">
            <h2 className="text-lg font-semibold mb-2">Resource Conflicts (Info)</h2>
            <p className="text-xs text-gray-600 mb-3">
              These events overlap in the same room/resource. If this affects you, notify your instructor.
            </p>
            <div className="space-y-3 text-sm">
              {resourceConflicts.map(conflict => {
                const aTitle = getBlockTitle(conflict.blockA);
                const bTitle = getBlockTitle(conflict.blockB);
                const timeRange = `${minutesToTimeDisplay(conflict.startMinutes)} - ${minutesToTimeDisplay(conflict.endMinutes)}`;
                const suggestion = conflict.suggestion
                  ? `Suggested alternate resource: ${conflict.suggestion.resource}`
                  : 'No alternate resource suggested';
                return (
                  <div key={conflict.id} className="border rounded-md p-3">
                    <p className="font-medium">{conflict.resource}</p>
                    <p className="text-gray-600">{conflict.day} · {timeRange}</p>
                    <p className="text-gray-700 mt-1">{aTitle} ↔ {bTitle}</p>
                    <p className="text-xs text-gray-500 mt-1">{suggestion}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="sticky top-0 z-10 bg-white border-b">
            <div className="flex">
              <div className="w-20 flex-shrink-0 border-r bg-gray-50" />
              {DAYS.map(day => (
                <div key={day} className="flex-1 text-center py-2 font-medium text-sm border-r last:border-r-0 bg-gray-50">
                  {day}
                </div>
              ))}
            </div>
          </div>

          <div className="flex">
            <div className="w-20 flex-shrink-0 border-r bg-gray-50">
              {timeSlots.map((minutes, idx) => (
                <div
                  key={idx}
                  className="text-right pr-2 text-xs text-gray-500 border-b"
                  style={{ height: SLOT_HEIGHT_PX, lineHeight: `${SLOT_HEIGHT_PX}px` }}
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
                    const template = templates.find(t => t.id === block.templateId);
                    return (
                      <ReadOnlyBlock
                        key={block.id}
                        block={block}
                        template={template}
                        dayStartMinutes={settings.dayStartMinutes}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
