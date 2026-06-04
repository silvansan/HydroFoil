export const config = {
  port: Number(process.env.PORT ?? process.env.CONTROL_API_PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://hydrofoil:hydrofoil_dev@localhost:5432/hydrofoil',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultOrganizationSlug: process.env.DEFAULT_ORGANIZATION_SLUG ?? 'default',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@hydrofoil.local',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD ?? 'change-me-now',
  defaultAdminDisplayName: process.env.DEFAULT_ADMIN_DISPLAY_NAME ?? 'HydroFoil Admin',
  defaultAdminRole:
    (process.env.DEFAULT_ADMIN_ROLE as 'super-admin' | 'admin' | 'manager' | undefined) ??
    'super-admin',
  defaultAdminActive: process.env.DEFAULT_ADMIN_ACTIVE !== 'false',
  /** When true, reset the bootstrap admin password from DEFAULT_ADMIN_PASSWORD on each start. */
  defaultAdminSyncPassword: process.env.DEFAULT_ADMIN_SYNC_PASSWORD === 'true',
  runMigrationsOnStart: process.env.RUN_MIGRATIONS_ON_START !== 'false',
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? 'hydrofoil-dev-auth-secret',
  playbackTokenSecret: process.env.PLAYBACK_TOKEN_SECRET ?? 'hydrofoil-dev-playback-secret',
  playbackTokenTtlSeconds: Number(process.env.PLAYBACK_TOKEN_TTL_SECONDS ?? 3600),
  srsWebhookSecret: process.env.SRS_WEBHOOK_SECRET ?? '',
  /** Public RTMP ingest base (OBS/encoders + operator UI copy links). */
  srsRtmpForwardBase: process.env.SRS_RTMP_FORWARD_BASE ?? 'rtmp://127.0.0.1:1935',
  /** Public SRT listener/caller host (defaults from PUBLIC_APP_URL or RTMP base hostname). */
  srsSrtPublicHost: process.env.SRS_SRT_PUBLIC_HOST ?? '',
  srsSrtPublicPort: Number(process.env.SRS_SRT_PUBLIC_PORT ?? 10080),
  /** RTMP base for media-worker to read from SRS (Docker: rtmp://srs:1935). */
  srsRtmpReadBase: process.env.SRS_RTMP_READ_BASE ?? process.env.SRS_RTMP_FORWARD_BASE ?? 'rtmp://127.0.0.1:1935',
  srsPlaybackBaseUrl: process.env.SRS_PLAYBACK_BASE_URL ?? 'http://127.0.0.1:8080',
  srsHttpApiUrl: process.env.SRS_HTTP_API_URL ?? 'http://localhost:1985',
  minioEndpoint: process.env.MINIO_ENDPOINT ?? 'localhost:9000',
  minioAccessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  minioSecretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  minioUseSsl: process.env.MINIO_USE_SSL === 'true',
  minioPublicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'localhost:9000',
  storageSecretKey: process.env.STORAGE_SECRET_KEY ?? '',
  /** Public URL of the operator UI (for links in email). */
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? '',
  /** Inbox for access requests and password-help notifications. */
  smtpAdminTo: process.env.SMTP_ADMIN_TO ?? process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@hydrofoil.local',
};
