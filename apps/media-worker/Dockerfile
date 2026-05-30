# Production media-worker — ffmpeg + compiled worker
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY packages/events/package.json packages/events/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY apps/srs-adapter/package.json apps/srs-adapter/
COPY apps/media-worker/package.json apps/media-worker/

RUN npm ci --workspace=@hydrofoil/media-worker --include-workspace-root

COPY packages/shared-types packages/shared-types
COPY packages/domain packages/domain
COPY packages/db packages/db
COPY packages/events packages/events
COPY packages/queue packages/queue
COPY packages/storage packages/storage
COPY apps/srs-adapter apps/srs-adapter
COPY apps/media-worker apps/media-worker
COPY tsconfig.json ./

RUN npm run build -w @hydrofoil/shared-types \
 && npm run build -w @hydrofoil/domain \
 && npm run build -w @hydrofoil/queue \
 && npm run build -w @hydrofoil/db \
 && npm run build -w @hydrofoil/events \
 && npm run build -w @hydrofoil/storage \
 && npm run build -w @hydrofoil/srs-adapter \
 && npm run build -w @hydrofoil/media-worker

FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl ffmpeg

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/domain/package.json packages/domain/
COPY packages/db/package.json packages/db/
COPY packages/events/package.json packages/events/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY apps/srs-adapter/package.json apps/srs-adapter/
COPY apps/media-worker/package.json apps/media-worker/

RUN npm ci --workspace=@hydrofoil/media-worker --include-workspace-root --omit=dev

COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/packages/domain/dist packages/domain/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/packages/events/dist packages/events/dist
COPY --from=build /app/packages/queue/dist packages/queue/dist
COPY --from=build /app/packages/storage/dist packages/storage/dist
COPY --from=build /app/apps/srs-adapter/dist apps/srs-adapter/dist
COPY --from=build /app/apps/media-worker/dist apps/media-worker/dist

WORKDIR /app/apps/media-worker

CMD ["node", "dist/index.js"]
