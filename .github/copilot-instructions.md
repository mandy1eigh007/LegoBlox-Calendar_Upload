# GitHub Copilot Instructions for LegoBlox Calendar Upload

## Project Overview

LegoBlox Calendar Upload is a comprehensive weekly schedule builder application for educational planning. It features drag-and-drop functionality, ICS import/export, predictive scheduling with machine learning, and Golden Rule hours tracking for compliance.

## Tech Stack

### Core Technologies
- **Frontend**: React 19 with TypeScript, Vite for bundling
- **Backend**: Express.js with TypeScript (Node.js)
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: React hooks (useState, useReducer) with local state
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest with React Testing Library
- **Drag & Drop**: @dnd-kit library

### Key Dependencies
- `wouter` for routing
- `date-fns` for date manipulation
- `zod` for schema validation
- `tesseract.js` for OCR functionality
- `ws` for WebSocket support
- `passport` with `passport-local` for authentication

## Code Organization

### Directory Structure
```
/client              - Frontend React application
  /src
    /components      - React components
    /hooks          - Custom React hooks
    /lib            - Utility functions and helpers
    /pages          - Page-level components
    /state          - State management and types
/server             - Backend Express API
/shared             - Shared code between client and server (schemas, types)
/predictive         - Machine learning models for schedule prediction
/script             - Build and utility scripts
/docs               - Documentation files
```

### Path Aliases
Use the following TypeScript path aliases:
- `@/*` maps to `./client/src/*`
- `@shared/*` maps to `./shared/*`

## Coding Conventions

### TypeScript
- **Strict mode enabled**: All code must pass strict TypeScript checks
- Use explicit types for function parameters and return values
- Prefer `interface` for object shapes, `type` for unions and complex types
- Use `const` assertions where appropriate

### React Components
- Use functional components with hooks (no class components)
- Prefer named exports over default exports
- Component file names use PascalCase: `WeekGrid.tsx`, `PlanEditor.tsx`
- Props interfaces should be named with component name + "Props": `interface WeekGridProps {}`

### State Management
- Use `useState` for local component state
- Use `useReducer` for complex state logic
- Types are defined in `client/src/state/types.ts`
- Key types: `Plan`, `PlacedBlock`, `BlockTemplate`, `Day`

### Styling
- Use Tailwind CSS utility classes for styling
- Custom utilities from `tailwind-merge` and `tailwindcss-animate`
- Component variants use `class-variance-authority`
- Radix UI components wrapped with custom styling

### Time and Calendar
- Time represented in minutes from midnight (e.g., 390 = 6:30 AM)
- Default day bounds: 6:30 AM (390 minutes) to 3:30 PM (930 minutes)
- Time slots snap to 15-minute increments
- Utility functions in `client/src/lib/time.ts`:
  - `minutesToTimeDisplay()` - Convert minutes to display format
  - `getEndMinutes()` - Calculate end time from start + duration
  - `durationToPixelHeight()` - Convert duration to pixel height
  - `minutesToPixelOffset()` - Convert minutes to pixel offset

### Database & Schema
- Use Drizzle ORM for database operations
- Schema definitions in `shared/schema.ts`
- Use `drizzle-zod` for creating insert/update schemas
- Database operations handled through `server/storage.ts`

### API Routes
- All API routes prefixed with `/api`
- Use Express request/response types
- Handle errors with appropriate HTTP status codes
- Example: `/api/predictive/solve` for schedule suggestions

## Development Workflow

### Commands
```bash
npm run dev              # Start development server (both client and backend)
npm run dev:client       # Start only Vite dev server on port 5000
npm run build           # Build for production
npm run check           # Run TypeScript type checking
npm test                # Run Vitest tests
npm run db:push         # Push database schema changes
```

### Predictive Scheduling Pipeline
```bash
npm run predictive:ingest         # Ingest training data
npm run predictive:build-model    # Build ML models
npm run predictive:solve          # Solve scheduling problem
npm run predictive:test           # Run full predictive pipeline test
```

### Timeline Management
```bash
npm run timeline:update    # Update development timeline
npm run timeline:snapshot  # Snapshot working tree
```

## Testing

### Test Location
- Tests located in `client/src/components/__tests__/`
- Test files use `.test.tsx` or `.test.ts` extension
- Configuration in `vitest.config.ts`

### Testing Conventions
- Use `vi` from Vitest for mocking
- Mock global fetch for API calls
- Use React Testing Library for component testing
- Test files should import from `@testing-library/react`
- Use `render`, `screen`, `fireEvent`, `waitFor` from Testing Library
- Tests run in jsdom environment with globals enabled

### Example Test Structure
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup mocks
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should test behavior', async () => {
    // Test implementation
  });
});
```

## Key Features and Patterns

### Block Templates
- Templates define reusable schedule blocks
- UNASSIGNED template (first in array) for unmatched imports
- Properties: `id`, `title`, `defaultDurationMinutes`, `countsTowardGoldenRule`, `goldenRuleBucketId`

### Drag and Drop
- Uses @dnd-kit for drag-and-drop functionality
- Blocks snap to 15-minute grid
- Placement respects day bounds
- Collision detection prevents overlapping blocks
- Activator pointer used to avoid jumpy placements

### ICS Import/Export
- Import ICS files with preview before committing
- Preview shows suggested template matches with confidence scores
- Titles preserved in `titleOverride` on imported blocks
- Unmatched events marked as UNASSIGNED (`templateId: null`)

### Template Matching
- Titles normalized: lowercase, punctuation stripped, whitespace collapsed
- Matching uses exact, alias, keyword, and fuzzy scoring with synonyms
- Confidence thresholds determine if match is accepted
- Manual assignments honored via manual assignment store

### Golden Rule Enforcement
- Tracks hours per `goldenRuleBucketId`
- Templates with `countsTowardGoldenRule: true` contribute to totals
- UI shows compliance status and warnings

### Predictive Scheduling
- Machine learning models for template placement suggestions
- Training data ingested from past calendars
- Solver suggests optimal placement based on learned patterns
- Confidence scores displayed for suggestions

## Important Notes

### Unassigned Behavior
- Imported events with unknown titles get `templateId: null`
- Display as "Unassigned" in calendar
- Explicit UNASSIGNED template in state for UI convenience
- Double-click to open reassign modal

### Block Interaction
- Single click: Select block
- Double click: Open reassign modal
- Drag: Move block (snaps to 15-minute grid)
- Resize: Adjust duration (respects time bounds)

### Student View and Publishing
- Plans can be published for student view
- Compare feature shows differences between plans
- Print view available for physical copies

## Git Workflow

### Timeline Updates
After feature commits, update the timeline:
```bash
npm run timeline:update
git add docs/DEV_TIMELINE.md
git commit --amend --no-edit
```

### Files to Ignore
- `node_modules/` - Dependencies
- `dist/` - Build output
- `server/public/` - Static files
- `.DS_Store` - macOS metadata
- `*.tar.gz` - Archives

## Additional Resources

- Development timeline tracked in `docs/DEV_TIMELINE.md`
- Working tree snapshots in `docs/WORKING_TREE_SNAPSHOT.md`
- UNASSIGNED behavior notes in `UNASSIGNED_README.md`
