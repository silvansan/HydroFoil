# Production control-api — compiled workspace packages + node dist entry
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY packages/events/package.json packages/events/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY apps/control-api/package.json apps/control-api/

RUN npm ci --workspace=@hydrofoil/control-api --include-workspace-root

COPY packages/shared-types packages/shared-types
COPY packages/domain packages/domain
COPY packages/db packages/db
COPY packages/events packages/events
COPY packages/queue packages/queue
COPY packages/storage packages/storage
COPY apps/control-api apps/control-api
COPY tsconfig.json ./

RUN npm run build -w @hydrofoil/shared-types \
 && npm run build -w @hydrofoil/domain \
 && npm run build -w @hydrofoil/queue \
 && npm run build -w @hydrofoil/db \
 && npm run build -w @hydrofoil/events \
 && npm run build -w @hydrofoil/storage \
 && npm run build -w @hydrofoil/control-api

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY packages/events/package.json packages/events/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY apps/control-api/package.json apps/control-api/

RUN npm ci --workspace=@hydrofoil/control-api --include-workspace-root --omit=dev

COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/events/dist packages/events/dist
COPY --from=build /app/packages/queue/dist packages/queue/dist
COPY --from=build /app/packages/storage/dist packages/storage/dist
COPY --from=build /app/apps/control-api/dist apps/control-api/dist
COPY packages/db/migrations packages/db/migrations

WORKDIR /app/apps/control-api

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/health >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
