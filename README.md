# LegoBlox Calendar Upload

A drag-and-drop weekly schedule builder designed for instructors to manage pre-apprenticeship cohort training schedules. The application enforces "Golden Rule" curriculum hour budgets with real-time tracking of scheduled vs. budgeted time across various training topics.

## Features

- **Drag-and-Drop Scheduling**: Create and manage multiple schedule plans with configurable weeks (default 9)
- **Block Templates**: Place reusable block templates onto a weekly grid (Mon-Fri, 6:30 AM - 3:30 PM)
- **15-Minute Granularity**: All scheduling operations snap to 15-minute time slots
- **Golden Rule Tracking**: Real-time budget tracking with over/under status for curriculum hours
- **Import/Export**: Support for CSV, ICS calendar, and JSON backup formats
- **Print-Friendly Views**: Generate printable schedules
- **Template Matching**: Intelligent matching of imported events to templates with confidence scoring
- **Predictive Scheduling**: ML-based calendar suggestions using historical data
- **Resource Management**: Track room and resource conflicts across schedules
- **Student View**: Read-only published schedules for students

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** - Build tool with custom Replit integration plugins
- **Tailwind CSS v4** - Styling with shadcn/ui component library (New York style)
- **Wouter** - Lightweight React router
- **@dnd-kit** - Drag-and-drop functionality
- **TanStack Query** - Server state management
- **Radix UI** - Accessible component primitives

### Backend
- **Express.js 5** on Node.js
- **PostgreSQL** - Primary database via Drizzle ORM
- **Passport.js** - Authentication with local strategy
- **Zod** - Schema validation

### Development
- **TypeScript** - Full type coverage across client, server, and shared code
- **Vitest** - Testing with React Testing Library and jsdom
- **tsx** - TypeScript execution
- **esbuild** - Server-side bundling

## Project Structure

```
/client           - Frontend React application
  /src            - React components, hooks, and utilities
    /components   - UI components (Builder, WeekGrid, BlockLibrary, etc.)
    /state        - Context store, types, validators
    /lib          - Utilities (time, collision, csv export, golden rule calc)
  /public         - Static assets

/server           - Express backend
  index.ts        - Express server entry
  routes.ts       - API route registration
  storage.ts      - Data access layer

/shared           - Shared types, schemas, and utilities
  schema.ts       - Drizzle database schema

/predictive       - Predictive scheduling module
  ingest.ts       - Training data ingestion
  model.ts        - Probability model building
  solver.ts       - Schedule optimization

/script           - Build and development scripts
/docs             - Documentation
/workspaces       - Curriculum master files and notes
```

## Getting Started

### Prerequisites

- Node.js 20 or higher
- PostgreSQL 16 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/mandy1eigh007/LegoBlox-Calendar_Upload.git
cd LegoBlox-Calendar_Upload
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
PORT=5000
NODE_ENV=development
```

4. Initialize the database:
```bash
npm run db:push
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

For client-only development with hot reload:
```bash
npm run dev:client
```

### Building for Production

```bash
npm run build
```

This will create a production-ready build in the `dist` directory.

### Running in Production

```bash
npm start
```

## Available Scripts

- `npm run dev` - Start development server (backend with hot reload)
- `npm run dev:client` - Start Vite dev server (port 5000)
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm test` - Run tests with Vitest
- `npm run db:push` - Push database schema changes
- `npm run predictive:test` - Run full predictive scheduling pipeline

## Key Concepts

### Time Handling
- All times stored as minutes from midnight (e.g., 390 = 6:30 AM)
- 15-minute slot granularity enforced throughout
- Default day bounds: 6:30 AM (390 minutes) to 3:30 PM (930 minutes)

### Block System
- **Templates**: Define reusable block configurations in the library
- **PlacedBlocks**: Instances of templates placed on the schedule grid
- **Recurrence**: Support for repeating blocks across weeks/days

### Golden Rule Enforcement
- Predefined budget buckets with minute allocations
- Blocks map to buckets via `goldenRuleBucketId`
- Real-time calculation of scheduled vs. budget with ±15 minute tolerance

### Template Matching
- Fuzzy matching with synonyms and confidence thresholds
- Manual assignments are persisted and honored
- Unmatched events have `templateId: null` (UNASSIGNED)
- Unassigned events don't count toward Golden Rule totals

### Predictive Scheduling
- **Ingest**: Process historical calendars and synonyms
- **Build Model**: Create probability models from training data
- **Solve**: Generate optimized schedules based on constraints
- See `/predictive/README.md` for detailed pipeline documentation

## Data Persistence

### Client-side
- **localStorage** for app state (plans, templates, blocks)
- Version 2 schema with migration support from v1

### Server-side
- **PostgreSQL** database (requires `DATABASE_URL` environment variable)
- Drizzle ORM with migrations in `/migrations` directory

## Testing

Run tests:
```bash
npm test
```

Tests are located in:
- `client/src/**/*.test.{ts,tsx}`
- `client/src/**/__tests__/**`

## Deployment

The application is configured for deployment on Replit with the following settings:

- **Build command**: `npm run build`
- **Run command**: `node ./dist/index.cjs`
- **Public directory**: `dist/public`

For other platforms, ensure:
1. PostgreSQL database is available
2. `DATABASE_URL` environment variable is set
3. Build artifacts are generated before starting the server

## Contributing

This project uses:
- **TypeScript strict mode** - All strict checks enforced
- **ESM** - ES module syntax throughout
- **Prettier** for code formatting
- **ESLint** for code quality

When contributing:
1. Ensure TypeScript type checking passes (`npm run check`)
2. Run tests (`npm test`)
3. Follow existing code patterns and conventions
4. Update documentation as needed

## License

MIT

## Support

For issues, questions, or feedback, please open an issue on GitHub.

## Acknowledgments

Built with ❤️ for ANEW-style pre-apprenticeship programs to simplify curriculum scheduling and Golden Rule compliance.
