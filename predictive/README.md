Predictive Calendar Module — Overview

Goal
- Provide a practical, explainable predictive scheduler that suggests placements for templates using historical calendars + a lightweight, deterministic probability model.

High-level components
1) Ingest/Normalize historical calendars
   - Parse ICS / training-calendars.json
   - Output training events with fields:
     - dayIndex (0..N-1 relative to cohort start)
     - weekIndex (1..9 target weeks)
     - startMinuteFromDayStart (0..420 where 06:30==0)
     - durationMinutes (multiple of 15)
     - location/resource
     - templateId (or null/UNASSIGNED)
     - originalTitle

2) Template synonyms
   - `template-synonyms.json` maps human text to canonical template titles
   - Used during normalization and matcher seeding

3) Probability model
   - For each templateId: track counts/distributions of weekIndex, dayIndex, startSlot, duration
   - Store simple histograms (counts) and compute top-N likely slots and confidence scores

4) Constraint solver (greedy + backtracking)
   - Place hard events first
   - Fill Golden Rule buckets using highest-probability placements that respect:
     - day bounds (06:30-15:30)
     - 15-min snapping
     - resource conflicts
     - Golden Rule budgets
   - Backtrack up to configurable attempts per block
   - Mark low-confidence placements as "Proposed" (needs approval)

5) UI & approval
   - Show proposed week view + list of proposed blocks (with confidence)
   - Allow Accept / Move / Swap / Reject per block; commit to calendar on Accept

Data Files (examples in this folder)
- training-calendars.json — minimal training upload format
- template-synonyms.json — synonym mappings to improve matching

Next dev tasks
- Implement ingestion + normalizer (produce canonical training events)
- Implement synonyms loader and apply during normalization
- Create per-template histograms and scoring API
- Build greedy constraint solver and small backtracker
- UI: proposed schedule modal + approval queue

Try it locally
- Drop ICS files or `training-calendars.json` into `predictive/` and run the ingestion script (TBD)

ICS ingestion (recommended)
1) Place .ics files under `attached_assets/`
2) Run: `npm run predictive:ics`
   - Generates `predictive/training-calendars.json`
   - Skips all-day placeholders (Week X, Lunch, etc.) and events outside 06:30–15:30
3) Run: `npm run predictive:ingest`
4) Run: `npm run predictive:build-model`

This produces `predictive/normalized-events.json` and `predictive/template-models.json`,
which the server uses for probability-driven placement.

