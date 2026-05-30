# HydroFoil Architecture

## Overview

HydroFoil is a clean, operator-friendly live media control plane built on top of **SRS** (Simple Realtime Server). It is a media routing and operations application, not a generic CMS.

**Division of responsibility:**

| Layer | Owns |
|-------|------|
| **HydroFoil** (Postgres + APIs) | Inputs, outputs, routes, policies, storage paths, sessions, assets, desired gateway state |
| **SRS** (runtime) | Ingest, forwarding, DVR hooks, observed publish/unpublish, playback transport |

SRS is not the business source of truth. HydroFoil computes **desired** routing/recording behavior; the target `srs-adapter` boundary reconciles that into SRS runtime configuration, while current publish/unpublish/forward hooks are handled by `control-api`.

**Post–E2E remodel:** See [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) for the proven publish path, control vs media plane split, playback modes (embed / preview / monitor), and phased build order.

## Proven end-to-end path (2026-05-28)

RTMP ingest → SRS → webhooks → `LiveSession` in Postgres → dynamic route forwards at publish → admin UI HLS preview popup. Gateway desired state is persisted via `reconcile-gateway-config`; runtime forwards are applied by SRS `forward.backend` hook (see roadmap for hybrid model).

## Playback modes (intentional split)

| Mode | Transport | Latency | Status |
|------|-----------|---------|--------|
| Embed / public watch | HLS | ~15–45s (tunable) | Copy link + embed in admin UI |
| Operator preview | HLS (popup) | ~30–40s today | Done |
| **Monitor live** | WebRTC (WHEP) preferred; FLV fallback | &lt; 2s target | Available in admin UI |

Do not use HLS alone for control-room monitoring. HydroFoil has a separate Monitor action for WHEP with FLV fallback.

## Core Principles

1. **Simplicity First** — Operations-focused UI that avoids generic CRUD clutter
2. **Single Source of Truth** — Postgres owns all business state
3. **Event-Driven** — Domain events trigger worker jobs and gateway actions
4. **Canonical Paths** — One model for storage paths (location + prefix template + filename template)
5. **Explicit Associations** — Session/media relationships are explicit in DB and event payloads
6. **Idempotent Operations** — Workers can safely retry failed jobs
7. **Gateway Abstraction** — UI and APIs use `gatewayAppName` / `gatewayStreamName`, not raw SRS config keys
8. **Policy → Event → Job** — Features react to policy and domain events; heavy work runs in idempotent jobs, not request handlers

## Layer boundaries (target architecture)

HydroFoil grows by **splitting responsibilities**, not by stuffing features into Core or the UI.

| Layer | Role | Talks to |
|-------|------|----------|
| **HydroFoil Core** | Stable control plane: orgs, inputs, outputs, routes, sessions, assets, gateway desired state, event bus, job enqueue, plugin registry (target) | Postgres, Redis (enqueue only) |
| **Official plugins** | Optional capabilities (DVR, cloud, republisher, remote recorder, audio, DRM, analytics, alerts/CMS connectors, transcoder) | Core services + capabilities only |
| **Media worker** | Heavy/async media jobs (finalize, transcode derivatives, upload, DRM package) | Storage service API, Postgres job status |
| **SRS adapter** | **Only** component that calls SRS HTTP API / applies runtime gateway state | SRS |
| **Storage service** | **Only** component that talks to MinIO/S3 (browse, move, delete, signed URLs) | Object storage |
| **Remote agents** | Separate authenticated workers (e.g. remote recorder on Windows/Linux) | Core API with scoped tokens — not SRS, not raw DB |

**Mindset:** Everything is **policy + event + job**. Plugins subscribe to events, read policy, enqueue jobs; they do not block HTTP requests with ffmpeg or uploads.

```
Plugin  →  Core GatewayService  →  srs-adapter  →  SRS        ✅
Plugin  →  Core StorageService  →  storage-service  →  S3   ✅
Plugin  →  SRS HTTP API directly                              ❌
Plugin  →  MinIO SDK directly                                 ❌
Plugin  →  unrestricted DB / .env / Docker socket               ❌
```

DRM stays **provider-neutral in Core** (interface only); `hydrofoil-drm` plugin implements vendors.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Admin UI (React)                         │
│                      Port 3000 — Vite proxy → API                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Control API (Express.js)                       │
│             Port 3001 — REST API — Business Logic                │
│  - CRUD: inputs, outputs, routes, domain blocks, storage         │
│  - Computes SRS desired config (gateway status endpoint)         │
│  - Live sessions, recordings (read); emits domain events (TBD)   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐         ┌────────┐        ┌────────┐
    │ Postgres │        │ Redis  │        │ MinIO  │
    │ Database │        │ Queue  │        │Storage │
    └────────┘         └────────┘        └────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ SRS Adapter │  │Media Worker │  │   Storage   │
  │  (partial)  │  │  (partial)  │  │   Service   │
  └─────────────┘  └─────────────┘  │  Port 3002  │
        │                  │         └─────────────┘
        └──────────────────┼──────────────────┘
                           │
                    SRS HTTP API (:1985)
                           │
                           ▼
           ┌────────────────────────────┐
           │  SRS (Simple Realtime      │
           │  Server)                   │
           │  RTMP :1935, HTTP :8080    │
           │  Ingest / forward / DVR    │
           └────────────────────────────┘
```

## Key Components

### 1. Control API (`apps/control-api`)

**Responsibility:** Core business logic, state management, event emission (events partially stubbed).

**Implemented endpoints:**

| Resource | Methods |
|----------|---------|
| Inputs | `GET`, `POST`, `GET/:id`, `PATCH/:id`, `DELETE/:id` |
| Outputs | `GET`, `POST`, `GET/:id`, `PATCH/:id`, `DELETE/:id` |
| Routes | `GET`, `POST`, `GET/:id`, `PATCH/:id`, `DELETE/:id` |
| Domain blocks | `GET`, `POST`, `GET/:id` |
| Storage locations | `GET`, `POST` |
| Live sessions | `GET`, `GET/:id` (detail + related routes/outputs) |
| Recordings | `GET` (list) |
| Webhooks | `POST /api/webhooks/srs`, `POST /api/webhooks/srs/forward` |
| Gateway | `GET /api/gateway/status` — live `SRSDesiredConfig` from DB |
| Health | `GET /api/health`, `GET /health` |

**Planned endpoints:** recording policies, stream profiles, audio feed profiles, recording delete/playback-url, generated audio assets.

**Technology:** Express.js, TypeScript, `@hydrofoil/db`, Zod validation, Pino logging.

**On startup:** Connects to Postgres, runs migrations (`RUN_MIGRATIONS_ON_START`, default true), resolves default organization (`DEFAULT_ORGANIZATION_SLUG=default`).

### 2. Admin UI (`apps/admin-ui`)

**Responsibility:** Desktop-first operations console.

**Pages:** Inputs, Outputs, Routes, Domain Blocks, Recordings, Live Sessions, Storage, System Status.

**Wired today:** List + create for inputs, outputs, routes, domain blocks, storage; Live Sessions (list, detail, HLS preview popup with copy link/embed); system status from `/api/health` and `/api/gateway/status`. Vite proxies `/api`, `/srs-media`, and `/live` → SRS (see `docs/BOOKMARK.md` for Docker proxy env).

**Technology:** React, TypeScript, Vite, Tailwind CSS, React Router, `@hydrofoil/ui-kit`.

### 3. Database (`packages/db`)

**Responsibility:** Schema, migrations, repositories, row mapping (snake_case ↔ camelCase).

**Migrations:** `001_initial_schema.sql`, `002_gateway_srs_rename.sql` (idempotent OME→gateway rename), `003_seed_default_organization.sql`.

**Runner:** `npm run migrate` — applies ordered SQL into `schema_migrations`.

**Core tables:** organizations, inputs, outputs, routes, stream_profiles, recording_policies, audio_feed_profiles, domain_blocks, storage_locations, live_sessions, recording_assets, generated_audio_assets, jobs, gateway_config_versions.

**Outputs schema (gateway fields):** `gateway_app_name`, `gateway_stream_name` (SRS app/stream at runtime).

**Stream profiles:** `gateway_mapping` JSONB — opaque hints for srs-adapter (transcode, forward, DVR).

### 4. Domain (`packages/domain`)

**Responsibility:** Pure business logic — no I/O.

**Services:** `RouteResolver`, `PathGenerator`, `RecordingPolicyResolver`, `AudioFeedJobDerivation`, `SRSGatewayConfigGenerator`, `GatewayDesiredStateBuilder`, `SessionAssetAssociation`.

**Desired config shape:** `SRSDesiredConfig` with `ingests[]` (per enabled route: stream key, forwards to output gateway app/stream, optional domain block policy).

### 5. SRS Adapter (`apps/srs-adapter`)

**Responsibility:** Translate HydroFoil desired gateway state into SRS runtime. Today, SRS publish/unpublish/forward webhooks are handled in `control-api`; long-term SRS runtime writes stay behind the adapter boundary.

**Status:** **Partial** — SRS reachability + stream listing; `reconcileDesiredConfig` records desired graph and runtime drift (active desired ingests, inactive desired ingests, unmanaged active streams). Forwards are applied at publish via the control-api hook, not SRS HTTP apply.

**Implemented elsewhere:**

- Webhooks handled in **control-api** (`on_publish`, `on_unpublish`, `on_forward`)
- `gateway_config_versions` written by media-worker reconciliation job

**Current adapter-owned runtime writes:**

- Session DVR start/stop uses SRS raw API through `srs-adapter`
- Reconciliation reports DVR support, runtime stream drift, and transcode mapping status

**Planned:**

- Map `SRSDesiredConfig` → SRS vhost transcode fragments plus deliberate reload/apply flow
- Optional forward refresh when routes change while stream is live

**Technology:** Axios (SRS HTTP API), TypeScript, Pino.

**SRS integration (v1 conventions):**

| HydroFoil | SRS runtime |
|-----------|-------------|
| `Input.streamKey` | RTMP publish name under app `live` |
| `Output.gatewayAppName` | SRS app |
| `Output.gatewayStreamName` | SRS stream name |
| `SRSDesiredConfig.defaultVhost` | `__defaultVhost__` |

### 6. Media Worker (`apps/media-worker`)

**Responsibility:** Async, idempotent media jobs.

**Job types (`@hydrofoil/queue`):**

- `finalize-recording`
- `generate-audio-asset`
- `reconcile-gateway-config` (was `reconcile-ome-config`)
- `extract-metadata`
- `move-media`, `delete-asset`

**Status:** **Partial** — `reconcile-gateway-config` persists desired gateway state; `finalize-recording` uploads SRS DVR FLV, can remux to MP4 after live stop/unpublish, optionally creates HLS, marks `RecordingAsset` ready, and schedules post-recording audio jobs. Audio generation uploads MP3/AAC/Opus derivatives. Worker storage now resolves both legacy bucket/prefix targets and remote storage-location references. Source FLV 24h retention is recorded in metadata and cleaned by the media worker after expiry.

### 7. Storage Service (`apps/storage-service`)

**Responsibility:** MinIO/S3-compatible abstraction — browse, move, delete, stat, signed playback URLs.

**Status:** **Partial** — Local MinIO and remote S3-compatible browse, stat, move, delete, and signed URL operations are wired through `@hydrofoil/storage`, `storage-service`, and storage-location API routes. Storage locations can carry endpoint, region, SSL, path-style, public endpoint, and write-only credentials. New credentials are encrypted when `STORAGE_SECRET_KEY` is configured. Gated MinIO integration tests cover core storage operations.

## Domain Model

### Entities

**Organization** — Tenant boundary (local dev: slug `default`).

**Input** — Ingest source (RTMP primary); `streamKey`; optional links to stream profile, recording policy, audio feed profile.

**Output** — Playback/forward destination; `gatewayAppName`, `gatewayStreamName`, `routeTarget`, protocol, domain block.

**Route** — Maps one input to many outputs; enable/disable.

**StreamProfile** — Renditions, transcode mode; `gatewayMapping` for adapter hints.

**DomainBlock** — Allowed domains, branding, playback access policy.

**RecordingPolicy** — Per-stream recording: storage location, path/filename templates, retention, segmentation.

**AudioFeedProfile** — MP3/AAC/Opus derivatives; storage + naming; live vs post-finalize.

**StorageLocation** — MinIO bucket + prefix path.

**LiveSession** — Runtime session on publish (SRS webhooks + optional SRS API sync on list).

**RecordingAsset** / **GeneratedAudioAsset** — Finalized media with explicit `objectKey` in DB.

**GatewayConfigVersion** — Desired vs applied gateway JSON and version numbers.

### Path Generation

Canonical model only:

```
object_key = join(storage.prefixPath, render(policy.pathPrefix), render(policy.filenameTemplate))
```

Templates support `{input-name}`, `{session-id}`, `{stream-key}`, `{date}`, `{timestamp}`, `{ext}`. No filename inference as source of truth.

## Policy → Event → Job (canonical flows)

All feature work should follow this pattern. Event names use `domain.action` (target); some legacy helpers in `@hydrofoil/events` still use PascalCase until unified.

### Republishing

```
Route changed (policy)
  → gateway.reconciliation.required
  → republisher plugin contributes desired forward outputs to gateway state
  → reconcile-gateway-config job
  → srs-adapter applies gateway state
```

### DVR (local recording)

```
stream.started
  → DVR plugin checks recording policy on input
  → recording.started / SRS DVR hook (via gateway, not direct plugin→SRS)
  → recording.finalized
  → finalize-recording job (media-worker)
  → RecordingAsset saved (Core)
```

### Cloud upload

```
recording.finalized
  → Cloud plugin checks upload policy
  → upload-to-cloud job
  → asset.remote_copy.created (metadata in Core)
```

### Remote recording

```
stream.started
  → Remote Recorder plugin checks watchlist policy
  → remote-recording-start job
  → remote agent (scoped token) records locally
  → stream.stopped → remote-recording-stop / remote-recording-finalize
  → agent reports file metadata → Core recording/remote asset row
```

### Audio / podcast derivatives

```
recording.finalized
  → Audio plugin checks audio_feed_profile
  → generate-mp3 | generate-aac | generate-opus job
  → GeneratedAudioAsset saved
```

### DRM

```
asset.created
  → DRM plugin checks DRM policy
  → package-drm job
  → provider.packageAsset() / createPlaybackPolicy() (plugin implements provider)
  → protected playback policy stored — no vendor hard-coded in Core
```

These flows are **target architecture**; wiring is partial. See [docs/CHECKLIST.md](docs/CHECKLIST.md).

## Plugin architecture (target — v1 official plugins only)

### HydroFoil Core (stable)

Trusted control plane, always present:

- Organizations, users/roles (planned), inputs, outputs, routes, domain blocks
- Storage locations, live sessions, recording assets, generated media assets
- Gateway desired state (`SRSDesiredConfig`, `gateway_config_versions`)
- Event bus (post-commit), job queue enqueue, plugin registry
- Capability grants, audit logs (planned)
- **Service facades** exposed to plugins: streams, routes, recordings, storage, gateway, audit

### Official plugins (optional, monorepo)

First-party packages under `plugins/` — enabled via DB + env, **no marketplace / no user-uploaded code in v1**.

| Plugin | Purpose |
|--------|---------|
| `hydrofoil-dvr` | Recording policies, DVR hooks, finalize, playback URLs |
| `hydrofoil-cloud` | Upload finalized assets to S3-compatible backends |
| `hydrofoil-republisher` | RTMP/SRT/etc. push to external destinations |
| `hydrofoil-remote-recorder` | Watchlists + jobs for remote recording agents |
| `hydrofoil-audio-generator` | MP3/AAC/Opus from recordings |
| `hydrofoil-drm` | Provider-neutral DRM packaging and playback tokens |
| `hydrofoil-analytics` | Session/gateway metrics and timelines |
| `hydrofoil-alerts` | Operator alerts for stream/session/gateway health |
| `hydrofoil-wordpress` / `hydrofoil-dnn` | CMS publishing connectors through signed/policy-controlled playback URLs |
| `hydrofoil-transcoder` | Transcode policies and worker/gateway jobs without putting vendor logic in Core |

Plugins register: API routes under `/api/plugins/:pluginId/*`, UI sidebar items, settings schemas (Zod), event handlers, job handlers.

### Capability-based API (examples)

Plugins declare capabilities in a manifest; Core enforces grants:

`streams.read` · `streams.write` · `routes.read` · `routes.write` · `recordings.read` · `recordings.write` · `recordings.delete` · `storage.read` · `storage.write` · `storage.signedUrl` · `storage.upload` · `gateway.reconcile` · `gateway.publishControl` · `republish.manage` · `drm.manage` · `analytics.read` · `jobs.enqueue` · `events.subscribe` · `settings.read` · `settings.write`

Suggested Core tables (not all migrated yet): `plugins`, `plugin_settings`, `plugin_capability_grants`, `plugin_audit_log`.

### Plugin security model

- **Core** is fully trusted.
- **Official plugins** are semi-trusted, capability-scoped, audited.
- **Third-party / marketplace plugins** — not supported in v1.
- Plugins cannot read `.env`, call SRS directly, use unrestricted DB clients, or access host/Docker.
- Secrets: encrypted or secret-store abstraction; UI never re-shows full stream keys after save.
- Remote agents: scoped tokens, task signing, path policy on agent host.
- Playback: signed URLs or policy-controlled tokens only.

### Developer surface (conceptual)

```typescript
interface HydroFoilPlugin {
  id: string;
  name: string;
  version: string;
  register(ctx: PluginContext): void | Promise<void>;
}

interface PluginContext {
  events: EventBus;
  jobs: JobRegistry;
  permissions: PermissionRegistry;
  settings: PluginSettingsRegistry;
  ui: PluginUIRegistry;
  api: PluginApiRegistry;
  services: {
    streams: StreamService;
    routes: RouteService;
    recordings: RecordingService;
    storage: StorageService;   // → storage-service, not MinIO SDK
    gateway: GatewayService;   // → srs-adapter, not SRS API
    audit: AuditService;
  };
}
```

Plugins use `PluginContext` services — not internal repositories unless explicitly granted.

### Domain events (target catalog)

`input.created` · `output.created` · `route.created` · `route.enabled` · `route.disabled` · `gateway.reconciliation.required` · `stream.started` · `stream.stopped` · `recording.started` · `recording.created` · `recording.finalized` · `recording.failed` · `asset.created` · `asset.deleted` · `asset.remote_copy.created` · `storage.object.created` · `storage.object.deleted` · `republish.started` · `republish.stopped` · `audio.asset.generation.requested` · `audio.asset.generated` · `drm.asset.packaging.requested` · `drm.asset.packaged`

### Job types (target catalog)

`reconcile-gateway-config` · `finalize-recording` · `remote-recording-start` · `remote-recording-stop` · `remote-recording-finalize` · `republish-start` · `republish-stop` · `generate-mp3` · `generate-aac` · `generate-opus` · `extract-metadata` · `create-thumbnails` · `upload-to-cloud` · `package-drm` · `delete-asset` · `enforce-retention`

**Implemented today:** queue enum includes a subset; handlers are mostly stubs.

### Admin UI (plugins area — planned)

Settings → Plugins: installed, enabled/disabled, permissions, per-plugin settings, logs. Each plugin may add sidebar routes, dashboard cards, stream/recording actions.

## Event flow (high level — target)

```
1. Operator changes routing/policy in Core → Postgres → gateway.reconciliation.required
2. srs-adapter reconciles SRSDesiredConfig → SRS runtime
3. stream.started (SRS webhook → Core) → LiveSession + plugin reactions
4. Plugins enqueue jobs → media-worker / remote agent / storage-service
5. recording.finalized / asset.created → downstream plugins (cloud, audio, DRM)
6. Operator browses assets via Core + signed URLs from storage-service
```

## Data Consistency

**Control API:** Entity writes via repositories; transactions for multi-table updates (as needed). Event emission post-commit (planned).

**Gateway reconciliation:** Desired config is persisted in `gateway_config_versions` before any SRS runtime apply. Full adapter apply is planned.

**Media worker:** Jobs idempotent; completion only after storage + DB consistent (planned).

**Paths:** One canonical model; all session/asset links explicit in DB.

## Local Development

```bash
npm install
npm run docker:up    # postgres, redis, minio, srs
npm run migrate
npm run dev -w @hydrofoil/control-api
npm run dev -w @hydrofoil/admin-ui
```

| Service | URL |
|---------|-----|
| Admin UI | http://localhost:3000 |
| Control API | http://localhost:3001 |
| Storage service | http://localhost:3002 |
| SRS HTTP API | http://localhost:1985 |
| SRS RTMP ingest | rtmp://localhost:1935/live/{streamKey} |
| SRS HTTP playback | http://localhost:8080 |
| MinIO console | http://localhost:9001 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

Config: see [.env.example](.env.example) — `DATABASE_URL`, `SRS_HTTP_API_URL`, `DEFAULT_ORGANIZATION_SLUG`.

## Implementation Status

**Production-minded today:** Domain logic, migrations, control-api CRUD, SRS webhooks + dynamic forward, live sessions, gateway reconciliation job, admin-ui routing + HLS preview + WebRTC/FLV monitor, Docker dev stack.

**Target/proposed:** Plugin architecture from `New_Prompt.md`: official monorepo plugins only, capability grants, plugin registry/settings/audit tables, SDK/runtime packages, and Settings → Plugins UI. No marketplace, arbitrary upload, or user-supplied executable code in v1.

**Stubbed / next:** SRS transcode hot-apply / deliberate reload flow, stream/recording/audio policy hardening, plugin registry/capability enforcement.

See [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md), [README.md](README.md) TODO, and [docs/MIGRATION_OME_TO_SRS.md](docs/MIGRATION_OME_TO_SRS.md).

## Technology Stack

| Layer | Technology |
|-------|------------|
| UI | React, TypeScript, Vite, Tailwind |
| API | Express.js, Node.js 18+, TypeScript |
| Database | PostgreSQL 16+ |
| Cache/Queue | Redis 7+, Bull |
| Storage | MinIO |
| Media runtime | **SRS 5** (`ossrs/srs`) |
| Monorepo | npm workspaces, Turbo |
| Validation | Zod |
| Logging | Pino |

## File structure (current + target)

```
HydroFoil/
├── apps/
│   ├── control-api/           # HydroFoil Core API
│   ├── admin-ui/
│   ├── media-worker/          # Heavy jobs only
│   ├── srs-adapter/           # Only SRS runtime client
│   ├── storage-service/       # Only object storage client
│   └── remote-recorder-agent/ # Future: scoped agent (not in repo yet)
├── packages/
│   ├── domain/
│   ├── db/
│   ├── events/
│   ├── queue/
│   ├── storage/               # Client lib for storage-service
│   ├── shared-types/
│   ├── ui-kit/
│   ├── plugin-sdk/            # Target
│   ├── plugin-runtime/        # Target
│   ├── permissions/           # Target
│   └── audit/                 # Target
├── plugins/                   # Target — official plugins only
│   ├── dvr/
│   ├── cloud/
│   ├── republisher/
│   ├── remote-recorder/
│   ├── audio-generator/
│   ├── drm/
│   ├── analytics/
│   ├── alerts/
│   ├── wordpress/
│   ├── dnn/
│   └── transcoder/
├── config/srs/
├── docs/
└── docker-compose.yml
```

## Phased roadmap (plugin-aware)

| Phase | Focus | Status |
|-------|--------|--------|
| 1 | Docs: Core vs plugins, security, events/jobs | In progress |
| 2 | Core plugin foundation (registry, sdk, capabilities, Plugins UI) | Not started |
| 3 | Post-commit event bus + idempotent workers | Partial (stubs) |
| 4 | SRS adapter/runtime: desired config apply, DVR/transcode; webhooks already handled in `control-api` | Partial |
| 5 | Storage service: MinIO/S3, signed URLs | Partial |
| 6 | First plugin: **DVR** (policies, finalize, RecordingAsset) | Not started |
| 7 | **Cloud** plugin | Not started |
| 8 | **Republisher** plugin | Not started |
| 9 | **Remote recorder** + agent | Not started |
| 10 | **Audio generator** | Not started |
| 11 | **DRM** plugin (provider interface) | Not started |

Aligns with [New_Prompt.md](New_Prompt.md) and [docs/CHECKLIST.md](docs/CHECKLIST.md).

## UX Philosophy

**Avoid:** Generic auto-generated forms, deep nested editors, raw SRS config in the UI, overlapping path concepts.

**Prefer:** Clear cards/tables, route summaries, storage and profile previews, obvious live status, operations-console feel.
