# Cohort Schedule Builder

## Overview

A drag-and-drop weekly schedule builder designed for instructors to manage pre-apprenticeship cohort training schedules. The application enforces "Golden Rule" curriculum hour budgets with real-time tracking of scheduled vs. budgeted time across various training topics.

Key functionality:
- Create and manage multiple schedule plans with configurable weeks (default 9)
- Drag-and-drop block templates onto a weekly grid (Mon-Fri, 6:30 AM - 3:30 PM)
- 15-minute time slot granularity for all scheduling operations
- Real-time Golden Rule hour budget tracking with over/under status
- Export to CSV, ICS calendar, and JSON backup formats
- Print-friendly view for schedules

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom plugins for Replit integration
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (New York style)
- **State Management**: React Context with useReducer pattern (no external state library)
- **Routing**: Wouter (lightweight React router)
- **Drag-and-Drop**: @dnd-kit/core and @dnd-kit/sortable for block placement and reordering

### Backend Architecture
- **Runtime**: Express.js on Node.js
- **API Pattern**: REST endpoints prefixed with `/api`
- **Storage Interface**: Abstracted IStorage interface supporting memory storage (MemStorage) with PostgreSQL-ready schema
- **Database ORM**: Drizzle ORM with PostgreSQL dialect configured

### Data Persistence
- **Client-side**: localStorage for app state (plans, templates, blocks)
- **Server-side**: PostgreSQL database (requires DATABASE_URL environment variable)
- **State Version**: Version 2 schema with migration support from v1

### Key Design Patterns

**Time Handling**:
- All times stored as minutes from midnight (e.g., 390 = 6:30 AM)
- 15-minute slot granularity enforced throughout
- SLOT_HEIGHT_PX (24px) maps to SLOT_MINUTES (15)

**Block System**:
- Templates define reusable block configurations
- PlacedBlocks are instances on the schedule grid
- Recurrence support for repeating blocks across weeks/days

**Golden Rule Enforcement**:
- Predefined budget buckets with minute allocations
- Blocks map to buckets via goldenRuleBucketId
- Real-time calculation of scheduled vs. budget with ±15 minute tolerance

### Project Structure
```
client/src/
  components/     # React components (Builder, WeekGrid, BlockLibrary, etc.)
  state/          # Context store, types, validators
  lib/            # Utilities (time, collision, csv export, golden rule calc)
server/
  index.ts        # Express server entry
  routes.ts       # API route registration
  storage.ts      # Data access layer
shared/
  schema.ts       # Drizzle database schema
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database via Drizzle ORM
- **Connection**: Requires `DATABASE_URL` environment variable
- **Migrations**: Stored in `/migrations` directory, run via `drizzle-kit push`

### Third-Party Libraries
- **@dnd-kit**: Drag-and-drop functionality
- **@tanstack/react-query**: Server state management (configured but minimal usage)
- **uuid**: Unique identifier generation
- **date-fns**: Date manipulation utilities
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, etc.)
- **Zod**: Schema validation for data integrity

### Build & Development
- **Vite**: Development server and production builds
- **esbuild**: Server-side bundling for production
- **TypeScript**: Full type coverage across client, server, and shared code