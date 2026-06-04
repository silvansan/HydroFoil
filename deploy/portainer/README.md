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

## Error: `lstat .../docker: no such file or directory`

You pasted **`PORTAINER_STACK.build.yml`** or an old stack with `build:` / `migrate:` services.

Fix: delete stack content, paste fresh **`PORTAINER_STACK.yml`** from GitHub.

---

## Custom admin UI port

Default host port is **3080** (not 3000). Set `ADMIN_UI_PORT` and match `PUBLIC_APP_URL`.

More: [docs/PRODUCTION_DEPLOY.md](../../docs/PRODUCTION_DEPLOY.md)
