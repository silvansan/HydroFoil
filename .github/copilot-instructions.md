<!-- HydroFoil Project Customization Instructions -->

# HydroFoil Development Guidelines

This is a TypeScript monorepo for a media routing and operations platform built on SRS.

## Architecture Overview

- **Apps**: control-api, admin-ui, media-worker, srs-adapter, storage-service
- **Packages**: domain, db, events, queue, storage, shared-types, ui-kit
- **Build System**: Turbo monorepo management
- **Package Manager**: npm with workspaces

## Code Standards

### TypeScript
- Strict mode enabled
- Minimal `any` types
- ESLint + Prettier for formatting
- Target: ES2020

### File Organization
- Source in `src/` directories
- Exports via `index.ts`
- Tests colocated with source
- Configuration files at package root

### Naming Conventions
- Domain models: PascalCase classes (e.g., `LiveSession`, `RecordingPolicy`)
- Functions: camelCase (e.g., `resolveRoute`, `generatePath`)
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case with extensions (e.g., `recording-policy.ts`, `domain-block.ts`)

### Imports
- Path aliases via `@hydrofoil/*` packages
- Absolute imports within apps
- No circular dependencies between packages

## Development Workflow

1. **Local Setup**: `npm install && npm run docker:up`
2. **Development**: `npm run dev` (starts all services)
3. **Type Checking**: `npm run type-check` before commits
4. **Testing**: `npm run test` ensures coverage
5. **Build**: `npm run build` validates all packages

## Domain Model

### Core Entities
- **Organization**: Tenant boundary
- **Input**: Ingest source (RTMP, etc.)
- **Output**: Playable destination
- **Route**: Input → Output mapping
- **StreamProfile**: Renditions and codec config
- **DomainBlock**: Access boundary and hostname grouping
- **RecordingPolicy**: Per-stream recording behavior
- **AudioFeedProfile**: Audio-only output generation
- **StorageLocation**: MinIO bucket/prefix
- **LiveSession**: Active publishing session
- **RecordingAsset**: Finalized media
- **GeneratedAudioAsset**: Audio derivative

### Path Generation
- Single canonical model: StorageLocation + PrefixTemplate + FilenameTemplate
- No overlapping path concepts
- Explicit DB associations for all session/media relationships

## Database
- Postgres is source of truth
- Migrations in `packages/db/migrations/`
- All domain entity schemas defined upfront
- Foreign keys enforce referential integrity

## API Design
- REST endpoints with clear CRUD operations
- Zod validation for request/response bodies
- Domain events for state changes
- Error responses follow standard format

## Testing Requirements

Must test:
- Route resolution logic
- Path generation from templates
- Recording policy derivation
- Generated audio job derivation
- OME desired config generation
- Session-to-asset associations
- MinIO storage operations

## Storage Operations
- MinIO is default backend
- Signed URLs for playback
- Retention policies enforced
- Browse, move, delete, stat operations supported

## OME Integration
- Desired config maintained in app
- Applied config versioning
- Stream-level routing via integration
- No tight coupling of business logic to OME

## Key Constraints
- No `chokidar` as source of truth
- No filename-based stream inference
- No business logic hidden in filesystem
- All associations explicit in DB/events
- Idempotent operations for media-worker

## Directory Structure
```
HydroFoil/
├── apps/
│   ├── control-api/
│   ├── admin-ui/
│   ├── media-worker/
│   ├── ome-adapter/
│   └── storage-service/
├── packages/
│   ├── domain/
│   ├── db/
│   ├── events/
│   ├── queue/
│   ├── storage/
│   ├── shared-types/
│   └── ui-kit/
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── turbo.json
```

## Common Tasks

### Add a New Entity
1. Define schema in `packages/db/migrations/`
2. Create domain model in `packages/domain/`
3. Add API endpoints in `control-api`
4. Expose in admin-ui

### Add a Background Job
1. Define job type in `packages/queue/`
2. Implement handler in `media-worker`
3. Trigger from control-api via event
4. Track via Job entity in DB

### Add Storage Operation
1. Implement in `packages/storage/`
2. Test with MinIO locally
3. Add to storage-service REST endpoints
4. Wire into media-worker if needed

## Debugging

### Local Services
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- MinIO: `localhost:9000` (console at 9001)
- OME: `localhost:1935` (RTMP), `localhost:80` (HTTP)
- Control API: `localhost:3001`
- Admin UI: `localhost:3000`

### Logs
- `npm run docker:logs` for container output
- Application logs via pino (structured JSON)

## Deployment Notes

- Production checklist not yet completed
- Local dev uses Docker Compose
- See README.md for next steps
- API versioning: `/api/v1/` for future compatibility
