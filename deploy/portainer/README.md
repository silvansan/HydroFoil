# Portainer — deploy HydroFoil

## Which file to paste?

| File | Use in Portainer Web editor? |
|------|------------------------------|
| **`PORTAINER_STACK.yml`** | **YES — paste this one** |
| `PORTAINER_STACK.build.yml` | **NO** — causes `lstat .../docker` error |
| `advanced/build-from-source.compose.yml` | Only with Git clone on the server |

Direct link (copy all):  
https://raw.githubusercontent.com/silvansan/HydroFoil/main/deploy/portainer/PORTAINER_STACK.yml

---

## Before first deploy

1. [Publish container images](https://github.com/silvansan/HydroFoil/actions/workflows/publish-images.yml) — run once, wait for green.
2. [Packages](https://github.com/silvansan?tab=packages) → each `hydrofoil-*` → **Public** visibility.

---

## Steps

1. **Stacks** → **Add stack** → **Web editor**
2. Paste **`PORTAINER_STACK.yml`** (from link above — not `.build.yml`)
3. **Environment variables** → **Advanced mode** → paste from **`.env.example`** (replace every `CHANGE_ME`)
   - Or upload edited **`.env.copypaste`**
   - Include:
     ```env
     HYDROFOIL_IMAGE_REGISTRY=ghcr.io/silvansan
     HYDROFOIL_IMAGE_TAG=latest
     ADMIN_UI_PORT=3080
     ```
   - `DATABASE_URL` password must match `POSTGRES_PASSWORD`
4. **Deploy**
5. Open `http://<server-ip>:3080` (or your `PUBLIC_APP_URL`)
6. Login → change password

---

## Live preview / playback (after deploy)

1. Wait for [Publish container images](https://github.com/silvansan/HydroFoil/actions/workflows/publish-images.yml) after pulling latest `main`.
2. **Update the stack** (fresh `PORTAINER_STACK.yml` includes SRS `http_remux` mount `[app]/[stream].flv`).
3. **Recreate** `srs`, `control-api`, and `admin-ui` so new images and SRS config apply.
4. While vMix/OBS is live, open preview — the UI calls `GET /api/playback/resolve` and plays the URLs SRS reports (not guessed paths).

Internal check from the server:

```bash
curl -s "http://127.0.0.1:3001/api/playback/resolve?app=gtch&stream=YOUR_STREAM" -H "Authorization: Bearer YOUR_JWT"
```

`playable: true` means HLS/FLV returned 200 from SRS.

---

## Error: `error from registry: denied`

Usually one of:

1. **Images not published yet** — [Publish container images](https://github.com/silvansan/HydroFoil/actions/workflows/publish-images.yml) must be **green** (all three jobs). If it failed, fix CI and re-run the workflow, then redeploy.
2. **Private GHCR packages** — [github.com/silvansan?tab=packages](https://github.com/silvansan?tab=packages) → each `hydrofoil-*` → **Package settings** → **Change visibility** → **Public**.
3. **Private packages + auth** — Portainer → **Registries** → add `ghcr.io` with a GitHub PAT (`read:packages`).

Test from the server (anonymous pull should work when public):

```bash
docker pull ghcr.io/silvansan/hydrofoil-control-api:latest
```

---

## Error: `lstat .../docker: no such file or directory`

You pasted **`PORTAINER_STACK.build.yml`** or an old stack with `build:` / `migrate:` services.

Fix: delete stack content, paste fresh **`PORTAINER_STACK.yml`** from GitHub.

---

## Custom admin UI port

Default host port is **3080** (not 3000). Set `ADMIN_UI_PORT` and match `PUBLIC_APP_URL`.

More: [docs/PRODUCTION_DEPLOY.md](../../docs/PRODUCTION_DEPLOY.md)
