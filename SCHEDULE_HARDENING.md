# Schedule Hardening Feature Implementation

This document describes the comprehensive schedule hardening features implemented in the feature/schedule-hardening branch.

## Overview

This implementation adds robust scheduling features to prevent data loss, improve UX, and enable cross-device collaboration. All features follow the requirement to use 15-minute increments and the 6:30 AM - 3:30 PM day window.

## Features Implemented

### A) Unassigned State for Imported Events ✅

**Problem**: Imported events were defaulting to the first template when confidence was low.

**Solution**: 
- Template matcher uses a 0.75 confidence threshold
- Requires 0.15 point separation between best and second-best matches
- Creates blocks with `templateId = null` when uncertain
- Unassigned blocks have `countsTowardGoldenRule = false`
- UI displays "Unassigned" label in amber/gray
- Golden Rule totals exclude unassigned blocks

**Files Modified**: None (feature already existed)

**Testing**:
```bash
1. Import an ICS file with events like "Team Meeting" or "Lunch"
2. Verify these appear as Unassigned (gray blocks with label)
3. Check Golden Rule totals panel - unassigned section shows count
4. Open UnassignedReviewPanel to bulk-assign templates
```

---

### B) Assignment UX (Double-Click + Bulk) ✅

**Problem**: No quick way to assign templates to imported blocks.

**Solution**:
- Double-click any calendar block → opens TemplateReassignDialog
- Search templates by name/keywords
- Shows Golden Rule info and bucket for each template
- Bulk selection via UnassignedReviewPanel
- Multi-select blocks by title group
- Bulk assign action applies template to all selected

**Files Modified**: Existing components (TemplateReassignDialog, UnassignedReviewPanel)

**Testing**:
```bash
1. Double-click a block → assignment dialog opens
2. Search for a template and assign it
3. Open UnassignedReviewPanel (click "Review and assign" in Golden Rule panel)
4. Select multiple blocks with same title
5. Choose template and bulk assign
6. Verify totals update correctly
```

---

### C) Snap-to-Grid Drag/Resize Accuracy ✅

**Problem**: Dragging blocks could drift or jump due to inconsistent pixel-to-time conversion.

**Solution**:
- Added centralized constants: `DAY_START_MIN = 390`, `DAY_END_MIN = 930`
- Created `pxToMinutes()` function accounting for scroll offset
- Created `clampToDay()` for bounds enforcement
- Updated `calculateDropMinutes()` to use centralized conversion
- All operations snap to 15-minute boundaries

**Files Modified**:
- `client/src/lib/time.ts`
- `client/src/components/Builder.tsx`

**Testing**:
```bash
1. Drag a block to 2:00 PM (840 minutes)
2. Release and verify it lands exactly at 2:00 PM
3. Drag again 5 times - should land at same position each time
4. Resize a block - should snap to 15-minute increments
5. Try dragging beyond day bounds - should clamp to 3:30 PM
```

---

### D) Resources + Calendar Comparison ✅

**Problem**: No way to detect resource conflicts across multiple plans.

**Solution**:
- Resource field already exists on PlacedBlock
- Added `ResourceType` enum: classroom_1, classroom_2, shop, other
- CompareMode detects resource overlaps across plans
- Groups conflicts by date/time/resource
- Shows alternative resource suggestions
- Highlights conflicting blocks in red

**Files Modified**:
- `client/src/state/types.ts` (added ResourceType)
- Existing: `client/src/components/CompareMode.tsx`

**Testing**:
```bash
1. Create two plans (Plan A, Plan B)
2. In both plans, add a block at Week 1, Monday, 9:00 AM in Classroom 1
3. Click "Compare" button in Builder
4. Select both plans
5. Verify conflict appears in conflict list
6. Check for alternative resource suggestion
```

---

### E) Custom Event Block Builder ✅

**Problem**: No way to create events with rich metadata (tours, speakers, site visits).

**Solution**:
- Created CustomEventBuilder component
- Event types: apprenticeship_tour, worksite_tour, guest_speaker, contractor_invite
- Fields: organization, contact name, email, phone, address, notes
- Resource selection with "other" free-text option
- Golden Rule bucket mapping
- Week/day/time placement with validation
- "Save as template" toggle (UI ready)

**Files Created**:
- `client/src/components/CustomEventBuilder.tsx`

**Files Modified**:
- `client/src/components/Builder.tsx` (added "Create Event" button)

**Testing**:
```bash
1. Click "Create Event" button in Builder toolbar
2. Select "Guest Speaker" event type
3. Fill in:
   - Title: "John Doe - Safety Expert"
   - Organization: "Safety First Inc"
   - Contact: "John Doe"
   - Email: "john@safety.com"
   - Phone: "(555) 123-4567"
   - Address: "123 Main St"
   - Notes: "Bring PPE examples"
   - Resource: Classroom 1
   - Week 1, Monday, 10:00 AM, 60 minutes
4. Create event
5. Double-click block → verify all fields are preserved
6. Check notes field contains formatted contact info
```

---

### F) Publish Student Read-Only View ✅

**Problem**: Published plans only work on the same device (localStorage).

**Solution**:
- Server endpoints for plan publishing:
  - `POST /api/plans/:planId/publish` - publishes plan
  - `GET /api/published/:slug` - retrieves plan
  - `DELETE /api/published/:slug` - unpublishes plan
- Storage in `server/data/published.json` (gitignored)
- PublishedView component renders read-only schedule at `/p/:slug`
- No edit controls, drag, or resize in published view
- Cross-device access via server persistence

**Files Created**:
- `client/src/components/PublishedView.tsx`
- `server/data/published.json` (created at runtime)

**Files Modified**:
- `server/routes.ts` (added publish endpoints)
- `client/src/App.tsx` (added /p/:slug route)
- `client/src/lib/publish.ts` (added server API calls)
- `client/src/components/Builder.tsx` (updated publish workflow)
- `.gitignore` (excluded server/data)

**Testing**:
```bash
1. Create a plan with several blocks
2. Click "Publish for Students" button
3. Copy the link (format: /p/XXX)
4. Open link in incognito window
5. Verify:
   - Schedule displays correctly
   - No edit buttons visible
   - Cannot drag or resize blocks
   - Week selector works
6. Close incognito window
7. Back in original window, click "Unpublish"
8. Try opening link again → should show "not found"
```

---

## Technical Details

### Time Conversion Functions

```typescript
// Centralized snap-to-grid conversion
export function pxToMinutes(
  y: number,
  gridRect: DOMRect,
  scrollTop: number,
  dayStartMinutes: number,
  headerHeight: number = 41
): number {
  const yWithinGrid = (y - gridRect.top - headerHeight) + scrollTop;
  const slotIndex = Math.round(yWithinGrid / SLOT_HEIGHT_PX);
  const minutesFromStart = slotIndex * SLOT_MINUTES;
  const rawMinutes = dayStartMinutes + minutesFromStart;
  return snapToSlot(rawMinutes, SLOT_MINUTES);
}

export function clampToDay(
  minutes: number,
  dayStartMinutes: number = DAY_START_MIN,
  dayEndMinutes: number = DAY_END_MIN
): number {
  return Math.min(Math.max(minutes, dayStartMinutes), dayEndMinutes);
}
```

### Server API

```typescript
// Publishing a plan
const response = await fetch(`/api/plans/${planId}/publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug, plan }),
});

// Retrieving published plan
const response = await fetch(`/api/published/${slug}`);
const data = await response.json();
// data.plan contains the full plan object
```

### State Management

New action types:
```typescript
| { type: 'ASSIGN_BLOCK_TEMPLATE'; payload: { planId: string; blockId: string; templateId: string; timestamp: string } }
| { type: 'ASSIGN_MULTIPLE_BLOCKS_TEMPLATE'; payload: { planId: string; blockIds: string[]; templateId: string; timestamp: string } }
| { type: 'UPDATE_PLAN_SETTINGS'; payload: { planId: string; settings: Partial<PlanSettings> } }
```

## Non-Negotiables Compliance

✅ **Do not invent curriculum hours or Golden Rule buckets**
- Used only existing `GOLDEN_RULE_BUCKETS` from types.ts
- CustomEventBuilder maps to existing buckets

✅ **Do not silently assign imported events**
- Template matcher returns null when uncertain
- Explicit Unassigned state required

✅ **All scheduling uses 15-minute increments**
- `SLOT_MINUTES = 15` constant enforced throughout
- Resize/drag handlers round to 15-minute boundaries

✅ **Day window 6:30 AM - 3:30 PM**
- `DAY_START_MIN = 390` (6:30 AM)
- `DAY_END_MIN = 930` (3:30 PM)
- `clampToDay()` enforces bounds

## Deployment Checklist

1. ✅ No new dependencies added
2. ✅ TypeScript compiles without errors
3. ✅ Server creates data directory automatically
4. ✅ Published plans stored in gitignored file
5. ✅ All features use existing state management
6. ✅ No breaking changes to existing functionality

## Future Enhancements (Not Implemented)

These were identified as already implemented or low priority:

- **Predictive Scheduling**: ScheduleSuggestionPanel already exists with basic functionality
- **UI Upgrade**: Current UI already meets quality standards (clean, no ANEW branding)

## Troubleshooting

### Published plans not accessible across devices
- Check `server/data/published.json` exists and is writable
- Verify server endpoints are accessible
- Check browser console for API errors

### Blocks jumping when dragging
- Verify `pxToMinutes()` is being called with correct scroll offset
- Check grid container has `data-testid="week-grid"` attribute
- Ensure `SLOT_HEIGHT_PX` matches CSS grid height

### Unassigned blocks not showing
- Check template matcher confidence threshold (should be 0.75)
- Verify import created blocks with `templateId = null`
- Check Golden Rule totals panel for unassigned count

## Code Review Notes

This implementation:
- Makes minimal changes to existing code
- Uses existing patterns and conventions
- Adds defensive null checks where needed
- Follows TypeScript best practices
- Maintains backward compatibility
- Does not modify database schema
- Uses localStorage for client state
- Uses JSON file for server state (simple, no DB needed)

## Summary

All core requirements from parts A-F are implemented and functional. Parts G-H were found to already exist or not require modification. The implementation provides a robust foundation for schedule management with proper validation, conflict detection, and cross-device publishing capabilities.
