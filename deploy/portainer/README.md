# Portainer — deploy HydroFoil in one session

No SSH required if you use **Git repository** in Portainer (Portainer clones and builds on the Docker host).

## Files (use these two)

| File | What to do with it |
|------|---------------------|
| **`PORTAINER_STACK.yml`** | Paste into the stack **Web editor**, *or* set as **Compose path** when using Git repository |
| **`.env.example`** | Copy values into Portainer **Environment variables** (see below) |

Optional: **`.env.copypaste`** — same variables, no `#` comments (handy for **Load variables from .env file** in Portainer).

---

## Method A — Git repository (recommended)

Best for teams and production: Portainer pulls the repo and builds images for you.

1. Open Portainer → **Stacks** → **+ Add stack**
2. Name: `hydrofoil` (or your choice)
3. Build method: **Repository**
4. Repository URL: `https://github.com/silvansan/HydroFoil.git` (or your fork)
5. Repository reference: `main` (or your release tag/branch)
6. **Compose path:** `deploy/portainer/PORTAINER_STACK.yml`
7. **Environment variables** → enable **Advanced mode**
   - Open `.env.example` in this folder in GitHub / your editor
   - Replace every `CHANGE_ME` value
   - Paste each `KEY=value` line into Portainer, **or** upload your edited `.env.copypaste` file
8. **Important:** `DATABASE_URL` must use the same password as `POSTGRES_PASSWORD`
9. Click **Deploy the stack**
10. Wait until all services are running (first deploy builds images — several minutes)
11. Open `PUBLIC_APP_URL` in a browser (or `http://<server-ip>:3000` if you have not added HTTPS yet)
12. Log in with `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD`, then **My profile** → change password

### Portainer environment UI tips

- Variable names are **case-sensitive** and must match `.env.example` exactly.
- Leave `SMTP_HOST` empty if you do not use email yet.
- `HYDROFOIL_BUILD_CONTEXT` can stay `.` when using Git repository deploy.

---

## Method B — Web editor (paste compose)

Use this when you cannot use Git in Portainer but the full HydroFoil repo already exists on the Docker host.

1. **Stacks** → **Add stack** → **Web editor**
2. Copy the entire contents of **`PORTAINER_STACK.yml`** and paste into the editor
3. Set **Environment variables** from edited `.env.example` (same as method A, step 7)
4. Set `HYDROFOIL_BUILD_CONTEXT` to the **absolute path** of the git clone on the server, e.g. `/opt/HydroFoil`
5. Deploy

If the repo is **not** on the server, use **Method A** instead — builds will fail without source code.

---

## After deploy

| Check | URL |
|-------|-----|
| Admin UI | `PUBLIC_APP_URL` or `http://<host>:<ADMIN_UI_PORT>` |
| API health | `http://<host>:<CONTROL_API_PORT>/health` |
| SRS | `http://<host>:<SRS_API_PORT>/api/v1/versions` |

Put HTTPS in front of the admin UI (nginx, Traefik, Caddy). The UI nginx config already proxies `/api`, `/srs-media`, `/live`, and `/srs-api` to internal services.

### WebRTC monitor (optional)

In `PORTAINER_STACK.yml`, find `rtc_server` → `candidate` and set it to a **public IP or DNS name** browsers can reach, then redeploy SRS. Open UDP/TCP port `8000` on the firewall.

### Encoder ingest

- RTMP: `rtmp://<your-host>:1935/live/<streamKey>`
- SRT: port `10080` (see HydroFoil input settings in the UI)

---

## TLS and reverse proxy

Terminate HTTPS at your reverse proxy and forward to `admin-ui` port 80 (inside the stack). Set `PUBLIC_APP_URL` to the HTTPS URL operators use.

---

## SMTP (optional)

Fill `SMTP_*` in environment variables so **Forgot password** and **Request access** on the login page send email. If `SMTP_HOST` is empty, forms still work but admins must be contacted manually.

---

## Updating the stack

1. Pull new code (Git stack: re-deploy or enable webhook/auto-update in Portainer)
2. Rebuild: **Pull and redeploy** or **Rebuild** the stack
3. Migrations run via the `migrate` job and `RUN_MIGRATIONS_ON_START` on control-api

---

## Troubleshooting

| Problem | What to check |
|---------|----------------|
| Build failed | Use Git repository method; confirm compose path `deploy/portainer/PORTAINER_STACK.yml` |
| `set POSTGRES_PASSWORD` error | Add all required env vars from `.env.example` |
| Login fails | `DEFAULT_ADMIN_*`, `AUTH_TOKEN_SECRET`; redeploy control-api after changing secrets |
| No live sessions | SRS hooks → control-api; `SRS_WEBHOOK_SECRET` if hooks are exposed |
| Black HLS preview | Proxy `/live` and `/srs-media` through the same host as the UI |

More detail: [docs/PRODUCTION_DEPLOY.md](../../docs/PRODUCTION_DEPLOY.md) · [docs/OPERATOR_RUNBOOK.md](../../docs/OPERATOR_RUNBOOK.md)

---

## Legacy filename

`docker-compose.stack.yml` is identical to `PORTAINER_STACK.yml`. Prefer **`PORTAINER_STACK.yml`** for new stacks.
