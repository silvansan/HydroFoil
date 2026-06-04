# Portainer — deploy HydroFoil in one session

Paste the stack in Portainer’s **Web editor** — no git clone on the server. Images are pulled from GitHub Container Registry.

## Before you deploy (once)

1. Open [GitHub Actions](https://github.com/silvansan/HydroFoil/actions/workflows/publish-images.yml) → run **Publish container images** (or wait until it finishes after a push to `main`).
2. Open [Packages](https://github.com/silvansan?tab=packages) → for each `hydrofoil-*` package → **Package settings** → set visibility to **Public** (so Portainer can pull without login).

## Your two files

| File | Use |
|------|-----|
| **`PORTAINER_STACK.yml`** | Copy entire file → Portainer **Web editor** |
| **`.env.example`** | Copy variables into **Environment variables** (Advanced mode) |

Optional: **`.env.copypaste`** — no `#` comments, for **Load variables from .env file**.

Add to env (defaults are fine if using `silvansan` images):

```env
HYDROFOIL_IMAGE_REGISTRY=ghcr.io/silvansan
HYDROFOIL_IMAGE_TAG=latest
```

---

## Steps in Portainer

1. **Stacks** → **+ Add stack** → name: `hydrofoil`
2. **Web editor** → paste all of **`PORTAINER_STACK.yml`**
3. **Environment variables** → **Advanced mode**
   - Edit `.env.example` locally: replace every `CHANGE_ME`
   - Paste each line, or upload your edited `.env.copypaste`
   - `DATABASE_URL` password must match `POSTGRES_PASSWORD`
4. **Deploy the stack**
5. Open `PUBLIC_APP_URL` or `http://<server-ip>:3000`
6. Log in with `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` → change password

---

## If you see `lstat .../docker: no such file or directory`

You are on an **old stack file** that tried to **build** from source. Update `PORTAINER_STACK.yml` from the latest `main` (image-based, no `build:` or `migrate` service).

---

## Build from source (advanced)

Only if the full repo exists on the Docker host:

- Use **`PORTAINER_STACK.build.yml`**
- Portainer **Git repository**: `https://github.com/silvansan/HydroFoil.git`, compose path `deploy/portainer/PORTAINER_STACK.build.yml`, `HYDROFOIL_BUILD_CONTEXT=.`

---

## After deploy

| Check | URL |
|-------|-----|
| Admin UI | `PUBLIC_APP_URL` or `http://<host>:<ADMIN_UI_PORT>` |
| API | `http://<host>:<CONTROL_API_PORT>/health` |

HTTPS: put a reverse proxy in front of `admin-ui` (port 80 inside the stack).

More: [docs/PRODUCTION_DEPLOY.md](../../docs/PRODUCTION_DEPLOY.md)
