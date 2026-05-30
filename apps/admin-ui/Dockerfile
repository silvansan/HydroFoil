# Production admin-ui: static build + nginx (API proxied to control-api)
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/admin-ui/package.json apps/admin-ui/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui-kit/package.json packages/ui-kit/
COPY packages/player/package.json packages/player/

RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --workspace=@hydrofoil/admin-ui --include-workspace-root

COPY apps/admin-ui apps/admin-ui
COPY packages/shared-types packages/shared-types
COPY packages/ui-kit packages/ui-kit
COPY packages/player packages/player

RUN npm run build -w @hydrofoil/admin-ui

FROM nginx:1.27-alpine

COPY apps/admin-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin-ui/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
