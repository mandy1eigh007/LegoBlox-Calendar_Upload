# Merge Summary (cursor/app-finalization-and-optimization-5539)

## Overview
This branch finalizes the Schedule Builder with:
- Predictive training from real ICS calendars + confidence labels
- Flexible Math bucket (tracked, not enforced) and bucket borrowing
- Anchor prompts with real dates, multi-date entries, and guided wizard
- Partner availability links with access code + approval flow
- Locked anchor events with editable unlock option

## Key features added
1) Predictive scheduling improvements
   - ICS ingestion pipeline and model generation
   - Title synonyms expanded for real calendar matching
   - Confidence scoring and server solver alignment

2) Golden Rule enhancements
   - Flexible Math bucket (no required target)
   - Borrow hours between buckets with adjustments UI

3) Anchor scheduling flow
   - Create plan prompts for anchor events (math, interviews, tours, speakers)
   - Actual date inputs and multiple dates per anchor
   - Auto-lock anchors, with edit override
   - Wizard popup and "Schedule anchors" entry point

4) Partner availability flow (approval required)
   - Generate link with simple code
   - Partners select slot and enter name/org/email/phone/notes
   - Admin approves and event is created as locked

## Tests run
- npm run check
- npm test -- --run

