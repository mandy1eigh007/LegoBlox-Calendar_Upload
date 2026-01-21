# Replit Smoke Test Checklist

## Setup
1) Import repo (main branch) into Replit
2) Run:
   - npm install --legacy-peer-deps
   - npm run dev

## Smoke tests

### Create plan + anchors
- Create a new plan
- Set start date and active days
- Check multiple anchor prompts
- Add multiple dates per anchor and create locked events
- Confirm events appear locked and can be unlocked for edits

### Anchor wizard
- Open plan and verify wizard appears
- Add or adjust anchor dates
- Create anchor events and confirm locked placement
- Re-open "Schedule anchors" and verify state persisted

### Partner availability
- Open Partner Availability panel
- Create link with code and slots
- Open partner link and submit selection
- Approve response and confirm locked event appears

### Predictive suggestions
- Switch to Predictive Builder
- Generate suggestions and confirm confidence badge appears

### Golden Rule
- Borrow hours between buckets and verify totals update

