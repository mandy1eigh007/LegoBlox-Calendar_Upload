# LegoBlox Calendar Upload - Copilot Instructions

## Project Overview
LegoBlox Calendar Upload is a full-stack TypeScript application for managing and scheduling calendar events with template-based event matching, predictive scheduling, and a drag-and-drop calendar interface.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4
- **Backend**: Express 5, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Testing**: Vitest with React Testing Library, jsdom
- **UI Components**: Radix UI, shadcn/ui patterns
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Authentication**: Passport.js with local strategy
- **Build Tools**: tsx, esbuild

## Project Structure
```
/client           - Frontend React application
  /src            - React components, hooks, and utilities
  /public         - Static assets
/server           - Express backend
/shared           - Shared types, schemas, and utilities (used by both client and server)
/predictive       - Predictive scheduling module (ML-based calendar suggestions)
/script           - Build and development scripts
/docs             - Documentation
/migrations       - Database migrations (Drizzle, created when generated)
```

## Path Aliases
- `@/*` → `./client/src/*` (frontend)
- `@shared/*` → `./shared/*` (shared types/schemas)
- `@assets/*` → `./attached_assets/*` (assets)

## Development Commands
- `npm run dev` - Start development server (backend with hot reload)
- `npm run dev:client` - Start Vite dev server (port 5000)
- `npm run build` - Build the application for production
- `npm run check` - Run TypeScript type checking
- `npm test` - Run tests with Vitest
- `npm run db:push` - Push database schema changes

## Coding Standards & Conventions

### TypeScript
- **Strict mode enabled** - All TypeScript strict checks are enforced
- **No `any` types** - Always provide proper types or use `unknown` with type guards
- **ESModules** - Use ES module syntax (`import/export`), not CommonJS
- **File extensions** - Allow importing TypeScript files with extensions (`.ts`, `.tsx`)

### React
- **React 19** - Use latest React patterns and hooks
- **Functional components only** - No class components
- **TypeScript for all components** - Use `.tsx` extension
- **Hooks conventions** - Follow React hooks rules and best practices

### Database & Schema
- **Drizzle ORM** - Use Drizzle for all database operations
- **Schema location** - All database schemas in `shared/schema.ts`
- **Zod validation** - Use `drizzle-zod` for schema validation (`createInsertSchema`)
- **Migrations** - Database changes must include migrations in `/migrations`

### Styling
- **Tailwind CSS 4** - Use Tailwind utility classes
- **Component patterns** - Follow shadcn/ui component patterns with Radix UI primitives
- **CSS-in-JS** - Avoid; prefer Tailwind utilities
- **Responsive design** - Use Tailwind responsive prefixes

### Testing
- **Test location** - Tests in `client/src/**/*.test.{ts,tsx}` or `client/src/**/__tests__/**`
- **Vitest globals** - `describe`, `it`, `expect` are available globally
- **Testing Library** - Use `@testing-library/react` for component tests
- **jsdom environment** - Tests run in simulated browser environment
- **Coverage** - Aim for meaningful test coverage of business logic

### API & Routes
- **RESTful conventions** - Follow REST principles for API endpoints
- **Express 5** - Use latest Express patterns
- **Type safety** - Share types between client and server via `@shared`
- **Error handling** - Use proper HTTP status codes and error responses

## Domain-Specific Context

### Calendar & Event System
- **Templates** - Events are matched to templates; unmatched events have `templateId: null` (UNASSIGNED)
- **Time bounds** - Default day bounds: 6:30 AM (390 minutes) to 3:30 PM (930 minutes)
- **Snapping** - Calendar placement snaps to 15-minute increments
- **Drag & drop** - Uses `@dnd-kit` for calendar interactions
- **ICS import** - Support for importing ICS calendar files with preview and matching

### Predictive Scheduling
- **Location** - Predictive module in `/predictive` directory
- **Pipeline** - Ingest → Build Model → Solve (see `predictive/README.md`)
- **Training data** - Uses historical calendars to build probability models
- **Confidence scoring** - Template matching includes confidence thresholds
- **Golden Rule** - Constraint system for event placement and budgeting

### Authentication
- **Passport.js** - Local strategy with username/password
- **Session management** - Express sessions with PostgreSQL store
- **User schema** - Defined in `shared/schema.ts`

## Best Practices

### Code Changes
- **Minimal changes** - Make surgical, focused changes
- **Type safety first** - Ensure all changes maintain type safety
- **Test your changes** - Run `npm test` for affected components
- **Type check** - Run `npm run check` before committing
- **Database changes** - Generate migrations with `drizzle-kit`

### Performance
- **Bundle size** - Keep bundle size minimal; avoid unnecessary dependencies
- **React Query** - Use for server state management and caching
- **Lazy loading** - Consider code splitting for large features

### Security
- **No credentials in code** - Use environment variables (`.env`)
- **Input validation** - Use Zod schemas for all user inputs
- **SQL injection** - Use Drizzle ORM's query builders, never raw SQL strings
- **XSS protection** - Sanitize user-generated content

### Documentation
- **JSDoc comments** - Add for complex functions and utilities
- **README updates** - Update documentation when adding features
- **Type definitions** - Use TypeScript types as documentation

## Common Patterns

### Creating a new API endpoint
1. Define types in `@shared` if needed
2. Add route in `server/routes.ts`
3. Implement handler with proper types
4. Add Zod validation for request body
5. Update client-side API calls

### Adding a new React component
1. Create in appropriate `client/src` subdirectory
2. Use TypeScript (`.tsx`)
3. Follow Radix UI + Tailwind patterns
4. Add tests in `__tests__` subdirectory or `.test.tsx`
5. Export from index file if needed

### Database schema changes
1. Update `shared/schema.ts`
2. Run `npm run db:push` for development
3. Generate migration for production
4. Update related TypeScript types

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (required)
- `NODE_ENV` - Environment (`development` or `production`)
- `REPL_ID` - Replit environment identifier (optional)

## Notes
- Project uses Replit-specific plugins in development (safe to ignore in other environments)
- Calendar event matching uses fuzzy scoring with synonyms and confidence thresholds
- Manual event assignments are persisted and honored over automatic matching
- The "Unassigned" template is a convenience UI element; unmatched events have `null` templateId
