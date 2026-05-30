# HydroFoil Implementation Checklist

Last updated: 2026-05-30

## Phase status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Scaffold workspace and apps | **Partial** |
| 2 | Database schema and migrations | **Partial** — `001`–`008` |
| 3 | Shared domain modules | **Partial** — logic + tests |
| 4 | Admin UI shell and navigation | **Partial** — inputs/outputs/routes CRUD + branding |
| 5 | Storage service + MinIO/S3 | **Partial** — local/remote browse/stat/move/delete/signed URLs wired; gated integration tests added |
| 6 | SRS adapter | **Partial** — client + worker reconcile; DVR raw API boundary wired; transcode hot-apply pending |
| 7 | Media worker | **Partial** — gateway reconcile, recording finalize, HLS/audio derivatives, source FLV cleanup wired; gated external-tool/storage tests added |
| 8 | Live session flow | **Partial** — E2E publish + HLS preview + WebRTC/FLV monitor |
| 9 | Per-stream recording flow | **Partial** — manual DVR start/stop, finalize job, storage upload, playback routes wired |
| 10 | Generated audio flow | **Partial** — live/post-recording jobs wired; ffmpeg integration tests pending |
| 11 | Tests (integration/e2e) | **Partial** — gated MinIO, webhook, and media-worker external-tool tests added |
| 12 | Docs / plugin architecture | **In progress** — target model documented; implementation not started |

## Milestone: Admin UI routing + branding (latest)

- [x] Inputs — stream key generator, RTMP publish URL preview, enable/disable
- [x] Outputs — SRS application + stream name, playback target suggestion
- [x] Routes — multi-output selection, route summary cards
- [x] HydroFoil logo in sidebar, cyan/teal dark gradient theme
- [x] Vite `strictPort: 3000` (avoids clashing with control-api on 3001)
- [x] Tailwind/PostCSS fix (CSS variables in `index.css`; no `@apply` on custom hydro tokens)
- [x] `docker compose up --build` — full dev stack (migrate + API + worker + admin-ui)

## Milestone: E2E streaming verified (2026-05-28)

- [x] vMix/OBS → RTMP → SRS → LiveSession in UI
- [x] Dynamic forward hook from routes
- [x] HLS preview popup + `/srs-media` + `/live` proxies (Docker-aware)
- [x] **Monitor live** — low latency (WebRTC WHEP preferred; FLV fallback) — see [ARCHITECTURE_ROADMAP.md](./ARCHITECTURE_ROADMAP.md)

## Milestone: Events + gateway reconciliation + webhooks

- [x] Dot-notation domain events (`gateway.reconciliation.required`, `stream.started`, …)
- [x] `GatewayOrchestrator` — publish event + idempotent Bull enqueue on routing mutations
- [x] `GatewayReconciliationService` — build desired config, version rows, hash dedup
- [x] Media worker `reconcile-gateway-config` handler
- [x] `POST /api/webhooks/srs` — `on_publish` / `on_unpublish` → LiveSession
- [x] Configure SRS `http_hooks` + dynamic `forward.backend` in `config/srs/srs.conf`
- [x] SRS dynamic forward via `POST /api/webhooks/srs/forward` (on publish)
- [x] SRS adapter runtime drift snapshot: active desired ingests, inactive desired ingests, unmanaged active streams
- [x] SRS DVR raw API start/stop behind `srs-adapter`
- [ ] SRS transcode runtime hot-apply / deliberate config reload path

## Must-have tests

- [x] Route resolution, path generation, SRS config, session association (domain)
- [x] Gateway reconciliation idempotency
- [x] Webhook → LiveSession integration
- [x] MinIO storage operations

## Milestone: Storage service MinIO/S3 operations

- [x] `@hydrofoil/storage` supports object browse, stat, copy/move, delete, and signed URLs.
- [x] `storage-service` exposes bucket/object browse, stat, move, delete, and signed URL endpoints.
- [x] `control-api` exposes the same object operations through storage locations.
- [x] Storage locations support remote S3-compatible endpoint, region, SSL, path-style, public endpoint, and write-only credentials.
- [x] New per-location credentials are encrypted when `STORAGE_SECRET_KEY` is configured.
- [x] Unit coverage for storage credential encryption and public mapper secret redaction.
- [x] Gated integration tests against MinIO.

## Milestone: Recording and audio media worker

- [x] Manual per-input DVR start/stop creates `RecordingAsset` rows and enqueues finalize jobs.
- [x] `finalize-recording` finds SRS DVR FLV files, uploads to storage, marks recordings ready, and optionally uploads HLS derivatives.
- [x] Recording policies can remux DVR FLV to MP4 after live stop/unpublish.
- [x] Recording policies can keep source FLV for 24 hours; worker stores `sourceFlvRetainUntil` metadata.
- [x] Post-recording audio derivative jobs are scheduled from finalized recordings.
- [x] Media worker storage resolves remote S3-compatible storage-location references for recording/audio upload and download.
- [x] Source FLV cleanup sweeper for expired `sourceFlvRetainUntil` metadata.
- [x] Gated integration tests for SRS DVR file discovery, ffmpeg HLS/audio generation, and storage upload.

## Production-ready today

- Core CRUD + gateway desired config persistence via worker
- Event emission on routing changes (in-process bus + Redis jobs)
- Live sessions from SRS webhooks (when hooks configured)

## Stubbed

- SRS transcode hot-apply / deliberate config reload path
- Plugin registry

## Plugin architecture target (from `New_Prompt.md`)

- [x] `ARCHITECTURE.md` documents Core vs official plugins, capability boundaries, plugin security model, event/job catalogs, and target monorepo structure.
- [ ] Plugin registry tables: `plugins`, `plugin_settings`, `plugin_capability_grants`, `plugin_audit_log`.
- [ ] Plugin SDK/runtime packages and Core service facades.
- [ ] Capability enforcement, audit logging, and plugin settings validation.
- [ ] Admin UI Settings → Plugins area.
- [ ] Official plugin packages: DVR, Cloud, Republisher, Remote Recorder, Audio Generator, DRM, Analytics.

For v1, plugins are planned as first-party monorepo packages only. No marketplace, arbitrary upload, or user-supplied executable code.
