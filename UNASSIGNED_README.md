UNASSIGNED behavior and matcher notes

- UNASSIGNED template: The app seed now includes an explicit "Unassigned" template in app state (first template). Unmatched imported events remain stored with `templateId = null` and display as Unassigned in the calendar. The Unassigned template in state exists for convenience in lists and UI.

- Matcher behavior:
  - Titles are normalized (lowercase, punctuation stripped, whitespace collapsed) and tokenized.
  - Matching uses exact, alias, keyword, and fuzzy scoring with synonyms.
  - Confidence thresholds: the matcher returns a template only when the top candidate score and margin meet internal thresholds; otherwise it returns `templateId: null` (UNASSIGNED).
  - Persisted manual assignments are honored via the manual assignment store.

- ICS import preview:
  - ICS files are parsed and a date range preview shown before committing.
  - Preview shows suggested matches + confidence; unmatched events are marked UNASSIGNED.
  - Titles are preserved in `titleOverride` on imported blocks.

- Dragging / snapping / bounds:
  - Calendar placement snaps to 15-minute increments.
  - Day bounds default to 6:30 AM (390) through 3:30 PM (930).
  - Drag drop drop calculations were adjusted to use the activator pointer to avoid jumpy placements.

- Assignment UI:
  - Double-click a block opens the Reassign modal with suggested matches and a toggle for "Counts toward Golden Rule" when applicable.
  - Bulk assignment still available in the Unassigned review panel.

- Student view / publish and compare features: unchanged in this patch (already present in the app).

Testing notes:
- Import an ICS with unknown titles → events appear as Unassigned (templateId=null).
- Double-click a block → Assign modal appears; confirm assign updates Golden Rule totals.
- Drag a block → placement snaps to 15-minute grid and respects day bounds.

