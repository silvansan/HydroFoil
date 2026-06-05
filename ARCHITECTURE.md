# HydroFoil Architecture

Last updated: **2026-06** — reflects the repo as deployed today (SRS control plane, operator UI, auth, VOD, protected playback). For phased build notes see [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md). For agent/product scope see [AGENTS.md](AGENTS.md).

## Overview

HydroFoil is an **operator-facing live media control plane** on **SRS** (Simple Realtime Server). It is not a generic CMS. Operators manage applications, stream keys (inputs), restream destinations, recording, storage, privacy policies, live sessions, VOD routes, and system health from one console.

| Layer | Owns |
|-------|------|
| **HydroFoil** (Postgres + APIs) | Applications, inputs, outputs, routes, policies, users, sessions, assets, gateway desired state, playback tokens |
| **SRS** (runtime) | Ingest, remux/HLS, forwarding, WebRTC/WHEP, DVR hooks, publish/unpublish |

Postgres is the business source of truth. SRS is runtime infrastructure. HydroFoil computes **desired** routing/recording behavior; `control-api` webhooks and `media-worker` reconciliation keep sessions and gateway versions aligned with what SRS is doing.

**Production deploy:** Portainer stack — [deploy/portainer/PORTAINER_STACK.yml](deploy/portainer/PORTAINER_STACK.yml), env template [deploy/portainer/.env.example](deploy/portainer/.env.example), guide [docs/PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md). Images publish via GitHub Actions; admin UI is **nginx** on port **3080** (proxies `/api`, `/srs-media`, `/srs-api`, `/rtc/`, `/embed`).

## System diagram (today)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Admin UI (React + Vite)                                              │
│  Dev: :3080 (Compose) · Prod: nginx static + proxy                    │
│  Routes: /system-status, /inputs, /restreaming, /live-sessions, …    │
│  Public: /embed (lean player bundle), /login                          │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ /api, /srs-media, /srs-api, /rtc
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Control API (Express) — port 3001                                    │
│  Auth (JWT), access scopes, CRUD, webhooks, playback resolver, proxy  │
└─────┬──────────────────┬────────────────────┬────────────────────────┘
      │                  │                    │
      ▼                  ▼                    ▼
 ┌─────────┐      ┌──────────┐         ┌─────────────┐
 │ Postgres │      │  Redis   │         │ MinIO / S3  │
 │ (state)  │      │ (Bull)   │         │ (assets)    │
 └─────────┘      └────┬─────┘         └──────┬──────┘
                       │                      │
                       ▼                      ▼
              ┌────────────────┐      ┌──────────────────┐
              │ Media worker   │      │ Storage service  │
              │ finalize, audio│      │ browse, signed   │
              │ gateway job    │      │ URLs (:3002)     │
              └────────┬───────┘      └──────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │  SRS adapter   │  (DVR API, drift/reconcile helpers)
              └────────┬───────┘
                       ▼
              ┌────────────────────────────────────────┐
              │  SRS 5 — RTMP :1935, HTTP :8080,       │
              │  API :1985, WebRTC :8000               │
              └────────────────────────────────────────┘
```

## Playback modes (intentional split)

| Mode | Transport | Use | Where |
|------|-----------|-----|--------|
| **Ingest** | RTMP / RTSP / SRT / HLS pull | Encoders (OBS, vMix) | Stream key ingest URL per application |
| **Monitor** | WebRTC (WHEP) preferred; HTTP-FLV fallback | Control room, &lt;2s target | Admin **Play** → `StreamMonitorModal` |
| **Operator preview** | HLS via `/srs-media` or resolver | Quick check in UI | Preview modals (higher latency) |
| **Public / embed** | HLS via `/embed` or iframe | Websites, CMS | `@hydrofoil/player`, policy-aware URLs |
| **Protected** | HLS/FLV via `/api/playback/live/…` | Signed links, domain allowlist | Domain blocks on outputs; tokens in embed URL |

Do not use HLS alone for monitoring. See [docs/LIVE_PLAYBACK.md](docs/LIVE_PLAYBACK.md).

**Embed delivery:** Production serves a **separate** `embed.html` bundle (no admin Tailwind CSS) at `/embed` to avoid CORS issues when third-party sites iframe the player. Copy/embed actions use `GET /api/inputs/:id/playback-url` so signed tokens appear immediately after assigning a privacy policy on a stream key.

**ABR:** `HydroFoilPlayer` shows an HLS quality selector when the manifest has multiple renditions (typical after ABR transcode profiles are live on SRS). Single-rendition ingest still plays without a menu.

## Applications and stream keys

- **Applications** group stream keys under a gateway app name (e.g. `gtch`), not only the default `live` app.
- Creating an **input** provisions a default **RTMP watch** output + route for monitor paths; web HLS may come from restream destinations or dedicated HLS outputs.
- Inputs support **multiple** recording policies, stream profiles, and audio feed profiles (junction tables, migration `009`).
- **Privacy policy** on a stream key (`domainBlockId` on PATCH) applies to all outputs on that input’s routes and drives signed/embed URLs from `playback-url`.

## Core principles

1. **Postgres owns business state** — sessions, assets, routes, policies, gateway versions.
2. **Policy → event → job** — route/input changes enqueue `reconcile-gateway-config`; recording/audio use media-worker handlers.
3. **Gateway abstraction** — `gatewayAppName` / `gatewayStreamName` on outputs; `SRSDesiredConfig` for adapter/reconciliation.
4. **Canonical storage paths** — `storage location + policy templates`; object keys stored on assets.
5. **Idempotent workers** — finalize, audio generation, FLV cleanup safe to retry.
6. **Separated planes** — UI/API never call SRS or S3 directly except via defined proxies/services.

## Apps (implemented today)

### Control API (`apps/control-api`)

Express + TypeScript + `@hydrofoil/db` + Zod. JWT auth (`/api/auth`), role/access scopes on routes, migrations on start (`RUN_MIGRATIONS_ON_START`).

| Area | Routes / behavior |
|------|-------------------|
| Auth & users | `/api/auth/*`, `/api/users/*` |
| Applications | `/api/applications` |
| Stream keys | `/api/inputs`, `/:id/sessions`, `/:id/playback-url`, `/:id/recording/*` |
| Routing | `/api/outputs`, `/api/routes`, `/api/restreams` (operator-facing restream model) |
| Policies | `/api/domain-blocks`, `/api/recording-policies`, `/api/stream-profiles`, `/api/audio-feed-profiles`, `/api/dvr-watchlist` |
| Live & assets | `/api/live-sessions`, `/api/recordings`, recording playback/archive routes |
| Playback | `/api/playback/resolve`, `/api/playback/live-token`, `/api/playback/live/:app/*` (protected proxy) |
| VOD | `/api/vod-routes`, public VOD playback router, `/:id/playback-url` |
| Storage | `/api/storage-locations` (+ object browse/sign via storage-service) |
| Gateway & ops | `/api/gateway/status`, `/api/system/*` (telemetry, bandwidth/CPU history) |
| SRS integration | `/api/webhooks/srs`, `/api/webhooks/srs/forward`, `/srs-media` proxy |
| Health | `/health`, `/api/health` |

On publish/unpublish, webhooks maintain `LiveSession` rows, emit domain events, and apply **dynamic forwards** (hybrid model: desired config in DB + hook-time forward URLs). See roadmap for full adapter-side transcode apply.

### Admin UI (`apps/admin-ui`)

React 18, Vite, Tailwind, `@hydrofoil/ui-kit`, `@hydrofoil/player`. **Requires login** for operator routes (`AuthContext`, `RequireAuth`).

| Section | Pages |
|---------|--------|
| Dashboard | System status — CPU/bandwidth charts, live-now rows with play/share actions |
| Ingest | Inputs (by application), application detail, stream key settings |
| Delivery | Restreaming (replaces legacy Outputs/Routes nav) |
| Live | Live sessions (on air), session detail |
| Policies | Domain blocks, recording policies, stream profiles, audio feeds |
| Assets | Recordings, storage browser, VOD routes |
| Admin | Users (admin-only), profile |

**Stream actions:** `StreamMediaActions` — Play (WebRTC), copy RTMP play URL, iframe embed code, HLS link; uses `inputId` + `playback-url` when policies require signing.

**Dev proxies:** `/api` → control-api; `/srs-media`, `/srs-api`, `/live` → SRS. **Prod nginx:** same paths + `location ^~ /embed` → `embed.html`.

### Media worker (`apps/media-worker`)

Bull/Redis job handlers (partial but used in dev/prod):

- `reconcile-gateway-config` — persist/compare `gateway_config_versions`
- `finalize-recording` — upload DVR FLV, optional MP4 remux/HLS, `RecordingAsset`, schedule audio jobs
- `generate-audio-asset` — MP3/AAC/Opus derivatives
- `source-flv-cleanup` — expired ingest FLV retention
- Additional handlers (restream push, remux, metadata) as wired in queue enum

### SRS adapter (`apps/srs-adapter`)

Boundary for SRS HTTP API: stream listing, reconciliation snapshots, **session DVR** start/stop. Full **transcode fragment hot-apply** to SRS vhost config is still planned; forwards at publish are handled in control-api today.

### Storage service (`apps/storage-service`)

S3/MinIO facade: list, stat, move, delete, signed URLs. Used by control-api and media-worker via `@hydrofoil/storage`. Remote storage locations support encrypted credentials (`STORAGE_SECRET_KEY`).

## Packages

| Package | Role |
|---------|------|
| `domain` | Pure logic: `RouteResolver`, `SRSGatewayConfigGenerator`, path templates, SRS forward/transcode helpers |
| `db` | Migrations `001`–`017`, repositories, gateway reconciliation service |
| `shared-types` | API/entity TypeScript shapes |
| `events` | Domain event names and payloads |
| `queue` | Job type definitions |
| `storage` | Storage-service client |
| `player` | `HydroFoilPlayer` (HLS + ABR selector), iframe/script embed builders |
| `ui-kit` | Shared React primitives |

**Not in repo yet (target):** `plugin-sdk`, `plugin-runtime`, `plugins/*` — see [New_Prompt.md](New_Prompt.md).

## Database (summary)

Migrations through **`017_user_access_scopes_phase2.sql`**. Notable additions since early docs:

- `004` applications · `009` multi-policy/profile assignments on inputs · `010` protocol config (RTSP/SRT)
- `011` VOD routes · `012` local storage + recording archives · `013` DVR watchlist · `014`–`017` users, passwords, access scopes

Core entities: organizations, applications, inputs, outputs, routes, stream_profiles, recording_policies, audio_feed_profiles, domain_blocks, storage_locations, live_sessions, recording_assets, generated_audio_assets, vod_routes, gateway_config_versions, users + scope assignments.

Outputs use `gateway_app_name`, `gateway_stream_name`, optional `domain_block_id`. Stream profiles store `renditions` + `gateway_mapping` for future adapter transcode apply.

## Gateway and SRS conventions

| HydroFoil | SRS runtime |
|-----------|-------------|
| `Application.appName` / input’s app | SRS app (e.g. `gtch`, `live`) |
| `Input.streamKey` | Publish name |
| `Output.gatewayAppName` + `gatewayStreamName` | Forward/play path |
| `SRSDesiredConfig.ingests[].forwards[]` | Forward graph at publish |

Env highlights: `SRS_HTTP_API_URL`, `SRS_PLAYBACK_BASE_URL`, `SRS_RTMP_FORWARD_BASE`, `PUBLIC_APP_URL`, `PLAYBACK_TOKEN_SECRET`, `VITE_*` for UI proxies in dev.

## Security and access (today)

- Session auth with JWT; login, profile, password reset/request-access flows in UI.
- Users: super-admin / admin / manager-style roles with **application**, **input**, **recording policy**, and **domain block** scope assignments (phase 2 scopes).
- **Domain blocks:** `public`, `token-required`, or `restricted` (allowlist). Enforced on `/api/playback/live/*` using output-linked policies.
- Operators copy **signed** HLS/embed URLs from stream key settings or row actions after assigning a policy.

## Target: plugin architecture (v1)

Long-term split documented in [New_Prompt.md](New_Prompt.md): official monorepo plugins only (`hydrofoil-dvr`, `hydrofoil-cloud`, `hydrofoil-republisher`, etc.), capability grants, no direct SRS/S3 access from plugins. **Not implemented** — Core monolith still owns the routes above.

```
Plugin → Core GatewayService → srs-adapter → SRS     ✅ (target)
Plugin → Core StorageService → storage-service → S3 ✅ (target)
Plugin → SRS or MinIO directly                      ❌
```

## Local development

```bash
npm install
npm run docker:up          # postgres, redis, minio, srs, migrate, api, worker, admin-ui
# UI: http://localhost:3080
```

Host-only API/UI:

```bash
npm run migrate
npm run dev -w @hydrofoil/control-api
npm run dev -w @hydrofoil/media-worker
npm run dev -w @hydrofoil/admin-ui
```

| Service | Default URL |
|---------|-------------|
| Admin UI | http://localhost:3080 |
| Control API | http://localhost:3001 |
| Storage service | http://localhost:3002 |
| SRS RTMP | rtmp://localhost:1935/{app}/{streamKey} |
| SRS HTTP / HLS | http://localhost:8080 |
| SRS API | http://localhost:1985 |

Config: [.env.example](.env.example), [.env.prod.example](.env.prod.example).

## Implementation status (honest snapshot)

**Working in production-style stacks**

- Full operator UI with auth, applications, stream keys, restreaming, policies, storage browser, VOD routes, recordings
- SRS webhooks → live sessions; dynamic forwards; gateway reconciliation job
- WebRTC monitor + FLV fallback; unified stream row actions; dashboard telemetry charts
- Protected live playback + per-input `playback-url`; lean `/embed` bundle
- Recording finalize, audio derivatives, signed recording/VOD playback URLs (partial hardening ongoing)

**Partial / in progress**

- SRS **transcode hot-apply** from stream profiles (stored in DB + desired config; runtime ABR depends on SRS config/reload)
- Plugin registry, capability enforcement, Settings → Plugins UI
- Post-commit event bus uniformity (some events emitted; not all flows plugin-ready)
- Multi-organization product features beyond scoped users (schema has orgs; single default org common in dev)

**Stubbed or planned**

- `remote-recorder-agent` app
- Marketplace / third-party plugins
- Full DRM packaging plugin

## Related documentation

| Doc | Purpose |
|-----|---------|
| [README.md](README.md) | Quick start, TODO, gateway API |
| [AGENTS.md](AGENTS.md) | Product scope for AI agents |
| [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) | Phased playback/gateway plan |
| [docs/LIVE_PLAYBACK.md](docs/LIVE_PLAYBACK.md) | Ingest vs monitor vs embed |
| [docs/RESTREAMING_ROUTES.md](docs/RESTREAMING_ROUTES.md) | Restream destination model |
| [docs/BOOKMARK.md](docs/BOOKMARK.md) | Dev traps (HLS proxy, Docker) |
| [docs/OPERATOR_RUNBOOK.md](docs/OPERATOR_RUNBOOK.md) | Operator procedures |
| [docs/MIGRATION_OME_TO_SRS.md](docs/MIGRATION_OME_TO_SRS.md) | OME → SRS rename history |

## Repository layout

```
HydroFoil/
├── apps/
│   ├── control-api/       # REST + webhooks + playback proxy
│   ├── admin-ui/          # Operator React app + embed.html entry
│   ├── media-worker/      # Bull job handlers
│   ├── srs-adapter/       # SRS HTTP client / DVR boundary
│   └── storage-service/   # Object storage API
├── packages/
│   ├── domain, db, events, queue, storage, shared-types
│   ├── player/            # Embed player + embed code helpers
│   └── ui-kit/
├── config/srs/            # srs.conf for Compose / deploy
├── deploy/portainer/      # Production stack + env templates
├── docs/
├── docker-compose.yml
├── ARCHITECTURE.md        # This file
└── AGENTS.md
```

## UX philosophy

**Avoid:** Raw SRS config in the UI, duplicate path concepts, treating monitor and embed as the same control.

**Prefer:** Application → stream key mental model, restream cards, policy templates with immediate copyable URLs, live session table with encoder stats, operations-console density without generic CRUD noise.
