import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Plan, BlockTemplate, DAYS } from '@/state/types';
import { minutesToTimeDisplay, getEndMinutes } from '@/lib/time';

export function PublishedView() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    async function loadPublishedPlan() {
      try {
        const response = await fetch(`/api/published/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Published plan not found. The link may be invalid or the plan may have been unpublished.');
          } else {
            setError('Failed to load published plan.');
          }
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        setPlan(data.plan);
        
        // Load templates from the plan's blocks to display titles
        const uniqueTemplateIds = new Set(data.plan.blocks.map((b: any) => b.templateId).filter(Boolean));
        const mockTemplates: BlockTemplate[] = Array.from(uniqueTemplateIds).map(id => ({
          id: id as string,
          title: 'Event',
          category: 'Other' as const,
          colorHex: '#6B7280',
          defaultDurationMinutes: 60,
          countsTowardGoldenRule: false,
          goldenRuleBucketId: null,
          defaultLocation: '',
          defaultNotes: '',
        }));
        setTemplates(mockTemplates);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading published plan:', err);
        setError('Failed to load published plan. Please try again later.');
        setLoading(false);
      }
    }
    
    loadPublishedPlan();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading published schedule...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Schedule Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const { settings } = plan;
  const weekBlocks = plan.blocks.filter(b => b.week === currentWeek);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">{settings.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Read-only view</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Week:</label>
            <select
              value={currentWeek}
              onChange={e => setCurrentWeek(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            >
              {Array.from({ length: settings.weeks }, (_, i) => i + 1).map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-sm text-blue-800">
              This is a read-only view. You cannot edit this schedule.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="grid grid-cols-6 border-b">
            <div className="px-4 py-3 bg-gray-50 font-medium text-sm text-gray-700 border-r">Time</div>
            {DAYS.map(day => (
              <div key={day} className="px-4 py-3 bg-gray-50 font-medium text-sm text-gray-700 border-r last:border-r-0 text-center">
                {day}
              </div>
            ))}
          </div>

          <div className="relative">
            {weekBlocks.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No blocks scheduled for this week
              </div>
            ) : (
              <div className="divide-y">
                {DAYS.map(day => {
                  const dayBlocks = weekBlocks.filter(b => b.day === day);
                  if (dayBlocks.length === 0) return null;

                  return (
                    <div key={day} className="grid grid-cols-6 min-h-[80px]">
                      <div className="px-4 py-3 bg-gray-50 font-medium text-sm text-gray-700 border-r">
                        {day}
                      </div>
                      <div className="col-span-5 p-4">
                        <div className="space-y-2">
                          {dayBlocks.map(block => {
                            const template = templates.find(t => t.id === block.templateId);
                            const title = block.titleOverride || template?.title || 'Event';
                            const isUnassigned = block.templateId === null;
                            const colorHex = isUnassigned ? '#9CA3AF' : (template?.colorHex || '#6B7280');

                            return (
                              <div
                                key={block.id}
                                className="rounded-lg p-3 text-white"
                                style={{ backgroundColor: colorHex }}
                              >
                                {isUnassigned && (
                                  <span className="text-xs font-bold bg-white/30 px-2 py-0.5 rounded mb-1 inline-block">
                                    Unassigned
                                  </span>
                                )}
                                <p className="font-medium">{title}</p>
                                <p className="text-sm opacity-90 mt-1">
                                  {minutesToTimeDisplay(block.startMinutes)} - {minutesToTimeDisplay(getEndMinutes(block.startMinutes, block.durationMinutes))}
                                  {' '}({block.durationMinutes} min)
                                </p>
                                {block.location && (
                                  <p className="text-xs opacity-80 mt-1">📍 {block.location}</p>
                                )}
                                {block.notes && (
                                  <p className="text-xs opacity-80 mt-1">{block.notes}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
