import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plan, PlacedBlock } from '@/state/types';
import { findTimeConflicts } from '@/lib/collision';
import { findAlternativeResource, getResourceUsageSummary } from '@/lib/calendarCompare';
import { minutesToTimeDisplay } from '@/lib/time';

interface ComparePlansProps {
  open: boolean;
  onClose: () => void;
  plans: Plan[];
  onOpenConflictInBuilder: (planId: string, blockId: string) => void;
  onResolveConflict?: (planId: string, blockId: string, newResource: string) => void;
}

export function ComparePlans({ open, onClose, plans, onOpenConflictInBuilder, onResolveConflict }: ComparePlansProps) {
  const [leftId, setLeftId] = useState<string | null>(plans[0]?.id || null);
  const [rightId, setRightId] = useState<string | null>(plans[1]?.id || plans[0]?.id || null);

  const leftPlan = plans.find(p => p.id === leftId) || null;
  const rightPlan = plans.find(p => p.id === rightId) || null;

  function collectConflicts(a: Plan, b: Plan) {
    const conflicts: { aBlock: PlacedBlock; bBlock: PlacedBlock }[] = [];
    for (const ab of a.blocks) {
      for (const bb of b.blocks) {
        if (ab.week !== bb.week || ab.day !== bb.day) continue;
        const overlaps = findTimeConflicts([bb], bb.week, bb.day, ab.startMinutes, ab.durationMinutes, undefined, ab.resource || ab.location || undefined);
        if (overlaps.length > 0) {
          conflicts.push({ aBlock: ab, bBlock: bb });
        }
      }
    }
    return conflicts;
  }

  const conflicts = leftPlan && rightPlan ? collectConflicts(leftPlan, rightPlan) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare Plans</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Plan A</p>
            <select className="w-full p-2 border rounded" value={leftId ?? ''} onChange={(e) => setLeftId(e.target.value || null)}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.settings.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-sm text-gray-600">Plan B</p>
            <select className="w-full p-2 border rounded" value={rightId ?? ''} onChange={(e) => setRightId(e.target.value || null)}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.settings.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <p className="font-medium">Conflicts ({conflicts.length})</p>
          <div className="max-h-96 overflow-y-auto mt-2 space-y-2">
            {conflicts.length === 0 && <p className="text-sm text-gray-500">No conflicts found between the selected plans.</p>}
            {conflicts.map((c, idx) => {
              const availableResources = (leftPlan?.settings.resources && leftPlan.settings.resources.length > 0) ? leftPlan.settings.resources : ['Classroom 1', 'Classroom 2', 'Shop', 'Offsite'];
              const altForA = leftPlan ? findAlternativeResource(c.aBlock, leftPlan, availableResources) : null;
              const altForB = rightPlan ? findAlternativeResource(c.bBlock, rightPlan, availableResources) : null;

              return (
                <div key={idx} className="p-3 border rounded flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{c.aBlock.titleOverride || c.aBlock.templateId || 'Untitled'}</p>
                    <p className="text-xs text-gray-600">{c.aBlock.week} · {c.aBlock.day} · {minutesToTimeDisplay(c.aBlock.startMinutes)} - {minutesToTimeDisplay(c.aBlock.startMinutes + c.aBlock.durationMinutes)} · {c.aBlock.resource || c.aBlock.location || 'No resource'}</p>
                    <p className="text-xs text-gray-500 mt-1">Conflicts with:</p>
                    <p className="text-xs text-gray-700">{c.bBlock.titleOverride || c.bBlock.templateId || 'Untitled'} — {minutesToTimeDisplay(c.bBlock.startMinutes)} - {minutesToTimeDisplay(c.bBlock.startMinutes + c.bBlock.durationMinutes)} · {c.bBlock.resource || c.bBlock.location || 'No resource'}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => leftPlan && onOpenConflictInBuilder(leftPlan.id, c.aBlock.id)}>Open in Builder (A)</Button>
                    <Button size="sm" onClick={() => rightPlan && onOpenConflictInBuilder(rightPlan.id, c.bBlock.id)}>Open in Builder (B)</Button>
                    {altForA && onResolveConflict && (
                      <Button size="sm" variant="outline" onClick={() => onResolveConflict(leftPlan!.id, c.aBlock.id, altForA)}>Suggest {altForA} for A</Button>
                    )}
                    {altForB && onResolveConflict && (
                      <Button size="sm" variant="outline" onClick={() => onResolveConflict(rightPlan!.id, c.bBlock.id, altForB)}>Suggest {altForB} for B</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ComparePlans;
