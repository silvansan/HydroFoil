# Production deployment checklist

**Greenfield:** this release expects a **new** Postgres database with migrations `001`–`017` applied in order. Do not reuse a DB that applied older migration filenames (e.g. `013_users.sql`).

Use this after merging and before handing HydroFoil to operators. Items marked **(you)** require your secrets, hostnames, or manual verification — they cannot be automated in the repo.

## 1. Choose a deployment path

| Path | When |
|------|------|
| [deploy/portainer/README.md](../deploy/portainer/README.md) | **Portainer:** paste `PORTAINER_STACK.yml` + env from `.env.example` (no SSH) |
| `npm run docker:prod` | Compose prod overlay — requires `.env.prod` from `.env.prod.example` |

**Compose:** `npm run env:prod` (or `cp .env.prod.example .env.prod`), replace every `CHANGE_ME` value **(you)**, then `npm run docker:prod`.

**Fresh database:** use empty Postgres volume (`docker compose down -v` only on first install, never on production with data).

**Portainer:** follow [deploy/portainer/README.md](../deploy/portainer/README.md) — paste `PORTAINER_STACK.yml`, set variables from `.env.example` **(you)**.

## 2. Secrets **(you)**

Generate long random strings (32+ characters) for:

- `AUTH_TOKEN_SECRET` — operator login JWT
- `PLAYBACK_TOKEN_SECRET` — signed playback / embed URLs
- `STORAGE_SECRET_KEY` — encrypts S3 credentials in the DB (**never rotate** after remote locations exist unless you re-save keys)
- `POSTGRES_PASSWORD` / `DATABASE_URL`
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` (or use external S3 only)
- `SRS_WEBHOOK_SECRET` — if SRS hooks are reachable outside the private network
- `DEFAULT_ADMIN_PASSWORD` — bootstrap admin (first boot only)

Do **not** commit `stack.env`, `.env`, or real passwords to git.

## 3. Public URLs **(you)**

Set to what browsers and encoders actually use:

- `PUBLIC_APP_URL` — HTTPS operator console (reverse-proxy hostname)
- `MINIO_PUBLIC_ENDPOINT` — host:port for signed URLs (no `https://`)
- `SRS_PLAYBACK_BASE_URL` / RTMP/SRT hostnames in stack env (see Portainer example)
- Reverse proxy must forward `/api`, `/srs-media`, `/live`, `/srs-api` to the admin-ui container (see `apps/admin-ui/nginx.conf`)

## 4. Database migrations **(you)**

On a **new** database, migrations run via the `migrate` Compose service and/or `RUN_MIGRATIONS_ON_START=true`.

After first deploy, verify **(you)**:

```sql
SELECT name FROM schema_migrations ORDER BY name;
```

You should see `001` through `017_user_access_scopes_phase2.sql`. See [packages/db/migrations/README.md](../packages/db/migrations/README.md).

## 5. Build and deploy **(you)**

```bash
# On the Docker host, from the git clone:
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache control-api media-worker admin-ui
# Portainer: update stack with new images / env, redeploy
```

Rebuild `admin-ui` when changing `VITE_WEBRTC_ICE_SERVERS` or other Vite build-time variables.

## 6. Automated smoke (repo)

```bash
npm run docker:prod:smoke
```

Checks API health, UI HTML, and `/api/health` through the UI proxy.

## 7. Manual operator smoke **(you)**

1. Log in as `DEFAULT_ADMIN_EMAIL` / password from stack env.
2. **Change the bootstrap password** (or create a new admin and deactivate bootstrap).
3. System Status — all green, no session-expired errors on protected routes.
4. Create a privacy policy (public) — confirm internal ID is auto-assigned.
5. Publish one live stream — Live Sessions, preview, optional recording finalize.
6. Storage browse + delete on a test folder (if using object storage).
7. Optional: moderator user with scoped apps / privacy policies (migrations 015–016).

## 8. SRS and WebRTC **(you)**

- Point SRS `http_hooks` at control-api (`config/srs/srs.conf` comments).
- For Monitor WebRTC outside localhost: set `rtc_server.candidate` in `srs.conf` to a public IP/DNS and open UDP/TCP `8000`.
- Set `VITE_WEBRTC_ICE_SERVERS` at admin-ui build if operators need TURN.

## 9. SMTP **(you, optional)**

Set `SMTP_*` in stack env for “Forgot password” / “Request access”. Leave `SMTP_HOST` empty to disable mail (UI still works).

## 10. Backup before upgrades **(you)**

- Postgres volume or dump
- MinIO / S3 bucket data
- `srs_data` while DVR files may not be finalized
- Copy of `stack.env` / secret manager values

See [OPERATOR_RUNBOOK.md](OPERATOR_RUNBOOK.md) for day-2 operations.
