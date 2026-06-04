# HydroFoil

A clean, operator-friendly live media control plane on **SRS** (Simple Realtime Server).

HydroFoil owns routing, recording policy, storage paths, and sessions. SRS is the runtime media engine for ingest, forwarding, DVR hooks, and playback plumbing.

This project uses **Cursor-AI assisted coding** for parts of the codebase.

## Deploy with Portainer (production)

One stack, one env file — no SSH required if you use **Git repository** in Portainer.

| Step | File / action |
|------|----------------|
| 1. Stack compose | Paste **`deploy/portainer/PORTAINER_STACK.yml`** only — **not** `PORTAINER_STACK.build.yml` |
| 2. Environment variables | [`deploy/portainer/.env.example`](deploy/portainer/.env.example) — replace every `CHANGE_ME` |
| 3. Deploy | See [`deploy/portainer/README.md`](deploy/portainer/README.md) |

**Web editor:** [Raw stack file](https://raw.githubusercontent.com/silvansan/HydroFoil/main/deploy/portainer/PORTAINER_STACK.yml) · Admin UI on host port **3080** by default · [Publish images](https://github.com/silvansan/HydroFoil/actions/workflows/publish-images.yml) workflow first.

**Bulk env import:** edit [`deploy/portainer/.env.copypaste`](deploy/portainer/.env.copypaste) and upload in Portainer **Advanced mode**.

Greenfield checklist: [docs/PRODUCTION_DEPLOY.md](docs/PRODUCTION_DEPLOY.md)

## Overview

HydroFoil is a **media routing and operations** application — not a generic CMS. Operators manage inputs, outputs, routes, domain blocks, recording policies, audio feeds, storage, live sessions, and assets from a desktop-first console.

## Project Structure

### Apps

| App | Role |
|-----|------|
| `control-api` | REST API, Postgres source of truth, domain events |
| `admin-ui` | React operations console |
| `media-worker` | Queue-driven media work; gateway reconciliation, recording finalization, HLS/audio derivatives, and source FLV cleanup are partial |
| `srs-adapter` | SRS HTTP client; reachability/listing, drift reporting, and DVR raw API boundary are wired; transcode hot-apply is still planned |
| `storage-service` | MinIO/S3-compatible facade for browse, stat, move, delete, and signed URLs |

### Packages

Current: `domain`, `db`, `events`, `queue`, `storage`, `shared-types`, `ui-kit`, `player`.

Target/plugin-aware additions: `plugin-sdk`, `plugin-runtime`, `permissions`, `audit`, plus official plugins under `plugins/`.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm 9+

### Local Development

**All-in-Docker (recommended):**

```bash
npm install                # once on host (for local tooling / migrate script)
npm run docker:up          # builds & starts infra + migrate + API + worker + admin-ui
```

If the UI reports a missing package after `git pull`, refresh deps in the container:

```bash
docker compose exec admin-ui sh -c "cd /app && npm install"
```

Or rebuild without the stale `node_modules` volume: `docker compose down -v` then `npm run docker:up`.

Open **http://localhost:3080** — Vite proxies `/api` to control-api inside Compose (override `ADMIN_UI_PORT` if needed).

**Host dev (optional):**

```bash
npm run docker:up          # infra only: comment out app services, or use partial compose
npm run migrate
npm run dev -w @hydrofoil/control-api
npm run dev -w @hydrofoil/media-worker
npm run dev -w @hydrofoil/admin-ui
```

**Production-style stack (greenfield — copy env first):**

```bash
cp .env.prod.example .env.prod   # edit secrets before real deploy
npm run docker:prod
npm run docker:prod:smoke
```

After changing routes, the media worker persists desired gateway config. Point SRS webhooks at `POST http://control-api:3001/api/webhooks/srs` (see `config/srs/srs.conf` comments).

- Admin UI: `http://localhost:3080` (proxies `/api` → control-api; default host port, not 3000)
- Control API: `http://localhost:3001`
- SRS HTTP API: `http://localhost:1985`
- RTMP ingest: `rtmp://localhost:1935/live/{streamKey}`
- MinIO console: `http://localhost:9001`

## TODO

> Keep this section updated as work lands. Detailed phase notes: [docs/CHECKLIST.md](docs/CHECKLIST.md)
> Main architecture direction: [ARCHITECTURE.md](ARCHITECTURE.md), aligned with [New_Prompt.md](New_Prompt.md).

### Done

- [x] Monorepo scaffold (apps + packages)
- [x] OME → SRS migration (gateway fields, `srs-adapter`, Compose SRS service)
- [x] Postgres schema migrations `001`–`017` + migration runner (`npm run migrate`; see `packages/db/migrations/README.md`)
- [x] Domain modules + unit tests
- [x] Admin UI shell + navigation
- [x] **control-api** Postgres CRUD: inputs, outputs, routes, domain blocks, storage locations
- [x] **control-api** gateway status (computed SRS desired config)
- [x] **admin-ui** wired to API (list + create on core pages, system status)
- [x] **E2E streaming** — RTMP ingest → SRS webhooks → Live Sessions → HLS preview popup

### In progress

- [x] Recording policies / stream profiles / audio feed profiles CRUD APIs
- [x] Gateway reconciliation foundation: route/input/output changes → `gateway.reconciliation.required` → Bull job → `gateway_config_versions`
- [x] SRS webhooks in `control-api` → `LiveSession` + `stream.started` / `stream.stopped` events (configure SRS `http_hooks`)
- [x] SRS adapter runtime drift snapshot in applied gateway config
- [ ] SRS adapter runtime apply is adapter-owned for DVR start/stop; SRS transcode hot-apply still requires static config/reload support
- [ ] Plugin architecture foundation — registry tables, capability grants, SDK/runtime packages, audit log, Plugins UI

### Next up

- [x] `storage-service` — local MinIO and remote S3-compatible browse, move, delete, stat, signed playback URLs
- [ ] `srs-adapter` — transcode runtime hot-apply and optional live forward refresh
- [x] `media-worker` — idempotent recording finalization, HLS/audio derivatives, remote S3-aware uploads/downloads, expired source FLV cleanup
- [x] Recording policies — optional MP4 remux after live stop and 24h source FLV retention metadata
- [x] Live session flow (publish → `LiveSession` in DB → HLS preview popup)
- [x] **Monitor live** — low-latency preview (WebRTC WHEP with FLV fallback)
- [x] Per-stream recording flow (policy → DVR → storage → `RecordingAsset`) is wired; integration hardening pending
- [x] Generated audio flow (MP3 / AAC / Opus jobs) is wired; integration hardening pending
- [x] Gated integration tests (MinIO storage operations, webhook route behavior, media-worker DVR/ffmpeg/storage)
- [x] Source FLV cleanup sweeper for expired 24h retention copies
- [x] App Dockerfiles + `docker compose up --build` dev stack
- [x] Deployment / operator runbook — see [docs/OPERATOR_RUNBOOK.md](docs/OPERATOR_RUNBOOK.md)

### Stubbed (not production-ready)

- SRS transcode hot-apply still requires deliberate srs.conf fragment rendering/reload support
- Current route forwards are handled by the SRS forward hook
- Plugin registry/capability/runtime packages not implemented — architecture is target/proposed for v1 official plugins

Architecture: [ARCHITECTURE.md](ARCHITECTURE.md) · Roadmap: [docs/ARCHITECTURE_ROADMAP.md](docs/ARCHITECTURE_ROADMAP.md) · Runbook: [docs/OPERATOR_RUNBOOK.md](docs/OPERATOR_RUNBOOK.md) · Resume: [docs/BOOKMARK.md](docs/BOOKMARK.md)

Migration reference: [docs/MIGRATION_OME_TO_SRS.md](docs/MIGRATION_OME_TO_SRS.md)

## Gateway API

- `GET /api/gateway/status` — desired vs applied gateway config (SRS)
- `GET /api/ome/status` — deprecated redirect to gateway status

## Configuration

```bash
DATABASE_URL=postgresql://hydrofoil:hydrofoil_dev@localhost:5432/hydrofoil
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost:9000
MINIO_PUBLIC_ENDPOINT=localhost:9000
STORAGE_SECRET_KEY=change-me-before-adding-remote-storage
AUTH_TOKEN_SECRET=change-me-min-32-chars
PLAYBACK_TOKEN_SECRET=change-me-min-32-chars
DEFAULT_ADMIN_EMAIL=admin@hydrofoil.local
DEFAULT_ADMIN_PASSWORD=change-me-now
SOURCE_FLV_CLEANUP_INTERVAL_MS=3600000
VITE_WEBRTC_ICE_SERVERS=stun:stun.l.google.com:19302
SRS_HTTP_API_URL=http://localhost:1985
DEFAULT_ORGANIZATION_SLUG=default
```

Copy from `.env.example` for local dev. **Production:** copy `.env.prod.example` → `.env.prod`, or deploy with Portainer using [deploy/portainer/PORTAINER_STACK.yml](deploy/portainer/PORTAINER_STACK.yml) + [deploy/portainer/.env.example](deploy/portainer/.env.example) — see [deploy/portainer/README.md](deploy/portainer/README.md).

`STORAGE_SECRET_KEY` encrypts newly saved per-location S3 credentials. Leave it stable once remote storage locations exist, otherwise encrypted credentials cannot be decrypted.
`AUTH_TOKEN_SECRET` signs operator JWTs; rotate only with a planned logout for all users.
`SOURCE_FLV_CLEANUP_INTERVAL_MS` controls how often the media worker deletes expired 24h source FLV copies; set it to `0` to disable the cleanup loop.
`VITE_WEBRTC_ICE_SERVERS` controls STUN/TURN servers used by the admin Monitor WHEP player (set at admin-ui **build** time for production images).

## Tests

```bash
npm run test -w @hydrofoil/domain
npm run test -w @hydrofoil/control-api
npm run test -w @hydrofoil/media-worker
RUN_INTEGRATION_TESTS=true npm run test -w @hydrofoil/storage
RUN_INTEGRATION_TESTS=true RUN_FFMPEG_INTEGRATION_TESTS=true npm run test -w @hydrofoil/media-worker
```

## License

AGPL-3.0. See [LICENSE](LICENSE).
