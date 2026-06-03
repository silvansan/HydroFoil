# HydroFoil Operator Runbook

Last updated: 2026-06-02

This runbook covers single-node Docker deployment and day-2 operations for HydroFoil. HydroFoil owns desired media state, metadata, jobs, and storage references; SRS remains the media runtime for ingest, live playback, DVR files, WebRTC, FLV, and HLS.

## Service Map

| Service | Role | Default port |
|---------|------|--------------|
| `admin-ui` | Operator console and same-origin media/API proxy | `3000` dev, `80` prod overlay |
| `control-api` | CRUD, webhooks, session lifecycle, recording orchestration | `3001` |
| `media-worker` | Gateway reconcile, DVR finalize, ffmpeg derivatives, retention cleanup | internal |
| `postgres` | Source of truth | `5432` |
| `redis` | Bull queues | `6379` |
| `minio` | Local S3-compatible object storage | `9000`, console `9001` |
| `srs` | RTMP/SRT ingest, HLS/FLV/WebRTC playback, DVR files | `1935`, `8080`, `1985`, UDP/TCP `8000`, UDP `10080` |

## First Install

1. Install Docker, Docker Compose, Node.js 18+, and npm 9+.
2. Copy `.env.example` to `.env` and replace development defaults before production use.
3. Set `STORAGE_SECRET_KEY` before adding remote S3 locations. Keep it stable, because encrypted storage credentials cannot be decrypted after rotation unless they are re-saved.
4. Set `SRS_WEBHOOK_SECRET` if SRS webhooks leave the Docker network.
5. Decide public hostnames for the admin UI, SRS playback, RTMP/SRT ingest, and MinIO public endpoint.

Full production checklist: [PRODUCTION_DEPLOY.md](PRODUCTION_DEPLOY.md).

## Authentication (production)

HydroFoil uses JWT bearer tokens for the admin UI and control-api (`Authorization: Bearer …`).

| Variable | Purpose |
|----------|---------|
| `AUTH_TOKEN_SECRET` | Signs login tokens — use a long random secret in production |
| `PLAYBACK_TOKEN_SECRET` | Signed playback / embed URLs |
| `PLAYBACK_TOKEN_TTL_SECONDS` | Token lifetime (default 3600) |
| `DEFAULT_ADMIN_EMAIL` | Bootstrap user created on first control-api start if missing |
| `DEFAULT_ADMIN_PASSWORD` | Initial password for that user only |
| `DEFAULT_ADMIN_ROLE` | Usually `super-admin` |
| `PUBLIC_APP_URL` | Base URL in password-reset / access-request emails |

After first login, change the bootstrap password. If operators see “session expired” on System Status while `/health` is OK, log in again — expired JWTs are cleared client-side.

Moderator scoping (applications, privacy policies, storage) requires migrations `015`–`016` and assignments on the Users page.

## Development Stack

```bash
npm install
npm run docker:up
```

Open `http://localhost:3000`. The dev admin UI proxies `/api` to `control-api`, `/srs-media` and `/live` to SRS HTTP playback, and `/srs-api` to the SRS HTTP API for WHEP signaling.

The optional storage-service facade is behind a Compose profile:

```bash
docker compose --profile storage up --build storage-service
```

## Production Compose

```bash
cp .env.prod.example .env.prod   # replace every CHANGE_ME
npm run docker:prod
npm run docker:prod:smoke
```

The production overlay uses production Dockerfiles and reads secrets from `.env.prod`. For Portainer, use `deploy/portainer/` instead. Change development credentials before exposing it:

- `POSTGRES_PASSWORD` and `DATABASE_URL`
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `STORAGE_SECRET_KEY`
- `AUTH_TOKEN_SECRET` and `PLAYBACK_TOKEN_SECRET`
- `DEFAULT_ADMIN_PASSWORD` (bootstrap only)
- `SRS_WEBHOOK_SECRET`
- `MINIO_PUBLIC_ENDPOINT`

Prefer putting production secrets in an environment file or deployment secret manager instead of committing them. Use [deploy/portainer/stack.env.example](../deploy/portainer/stack.env.example) as a template.

## Network And TLS

Expose only what operators and encoders need:

- RTMP ingest: TCP `1935`
- SRT ingest: UDP `10080`
- WebRTC media: UDP/TCP `8000`
- Admin UI: HTTPS via reverse proxy to `admin-ui`
- HLS/FLV/WHEP: proxy through the admin UI origin when possible

Keep `control-api`, Postgres, Redis, MinIO API, and SRS HTTP API private unless there is a specific operational reason to expose them. Terminate TLS at a reverse proxy in front of `admin-ui`; make sure `/api`, `/srs-media`, `/live`, and `/srs-api` continue to proxy to the right internal services.

For WebRTC outside localhost, set the SRS `rtc_server.candidate` in `config/srs/srs.conf` to an address browsers can reach, then restart SRS. If operators are behind restrictive NATs, set `VITE_WEBRTC_ICE_SERVERS` to comma-separated STUN/TURN URLs for the admin UI build/runtime.

## SRS Integration

`config/srs/srs.conf` enables:

- `http_hooks` for `on_publish` and `on_unpublish`
- dynamic `forward.backend` for route destinations
- HLS, HTTP-FLV, DVR, RTC, and SRT on both `localhost` and `__defaultVhost__`

In Compose, SRS calls `http://control-api:3001/api/webhooks/srs` and `.../forward`. If SRS runs outside the Compose network, update those hook URLs and set `SRS_WEBHOOK_SECRET` on both sides.

DVR files are written under the SRS HTTP root and mounted into `media-worker` as `/srs-dvr`. Do not remove the `srs_data` volume unless you accept losing local DVR files that have not yet been finalized to storage.

## Smoke Tests

Run the built-in liveness smoke:

```bash
npm run docker:prod:smoke
```

Then run an operator media smoke:

1. Create an input in the Admin UI and copy its RTMP URL.
2. Publish from OBS, vMix, or ffmpeg to `rtmp://host:1935/<app>/<streamKey>`.
3. Confirm the stream appears in Live Sessions.
4. Open Preview for HLS and Monitor for WebRTC/FLV.
5. Start recording, stop the encoder, and confirm a Recording asset becomes ready.
6. If using remote S3 storage, browse the storage location and verify signed playback works.

## Integration Tests

Fast unit tests run without Docker. Gated integration tests require local services:

```bash
docker compose up -d postgres redis minio srs
RUN_INTEGRATION_TESTS=true npm run test -w @hydrofoil/storage
RUN_INTEGRATION_TESTS=true RUN_FFMPEG_INTEGRATION_TESTS=true npm run test -w @hydrofoil/media-worker
npm run test -w @hydrofoil/control-api
```

The ffmpeg integration suite expects `ffmpeg` on `PATH`. It is present in the project Docker images; install it locally if running tests on the host.

## Monitoring And Troubleshooting

- API health: `GET /health` and `GET /api/health`
- Gateway status: `GET /api/gateway/status`
- SRS API: `GET http://localhost:1985/api/v1/versions`
- Container logs: `npm run docker:logs`

Common issues:

- HLS preview fails: verify `/srs-media` and `/live` proxy to SRS `:8080`.
- Monitor WebRTC fails but FLV works: check SRS `rtc_server.candidate`, UDP `8000`, and `VITE_WEBRTC_ICE_SERVERS`.
- Live sessions do not appear: check SRS `http_hooks`, `SRS_WEBHOOK_SECRET`, and control-api logs.
- Recording does not finalize: check `media-worker` logs, `SRS_DVR_ROOT`, the `srs_data` mount, and MinIO credentials.
- Remote S3 credentials fail: verify `STORAGE_SECRET_KEY` has not changed since credentials were saved.
- System Status shows errors but `/health` is OK: operator JWT expired — log in again.
- Privacy allowlist not enforced: policy must be `restricted` with at least one domain; attach policy to output or VOD route.

## Backup And Restore

Back up at least:

- Postgres database or `postgres_data` volume
- MinIO bucket data or remote S3 bucket
- `srs_data` while DVR files may still be pending finalization
- `.env` or secret-manager values, especially `STORAGE_SECRET_KEY`

For restore, bring up Postgres first, run migrations, restore object storage, then start `control-api`, `media-worker`, and `admin-ui`.

## Upgrade And Rollback

1. Back up Postgres and storage before applying migrations.
2. Pull or build the new images.
3. Run migrations once through the `migrate` service or `RUN_MIGRATIONS_ON_START` (see `packages/db/migrations/README.md`).
4. Start app services and run `npm run docker:prod:smoke`.
5. Run the media smoke before handing the system back to operators.

Avoid `docker compose down -v` on production systems; it deletes named volumes.

## Known Limits

- SRS route forwarding is publish-time via the SRS forward hook.
- SRS transcode mappings are surfaced in gateway status, but hot-applying transcode config still requires deliberate SRS config/reload support.
- Plugin registry, capability grants, and Plugins UI are planned but not part of this runtime-hardening tranche.
