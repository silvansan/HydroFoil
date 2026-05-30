export const config = {
  port: Number(process.env.PORT ?? process.env.CONTROL_API_PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://hydrofoil:hydrofoil_dev@localhost:5432/hydrofoil',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultOrganizationSlug: process.env.DEFAULT_ORGANIZATION_SLUG ?? 'default',
  runMigrationsOnStart: process.env.RUN_MIGRATIONS_ON_START !== 'false',
  srsWebhookSecret: process.env.SRS_WEBHOOK_SECRET ?? '',
  /** RTMP base used when SRS asks for dynamic forward URLs (on_forward hook). */
  srsRtmpForwardBase: process.env.SRS_RTMP_FORWARD_BASE ?? 'rtmp://127.0.0.1:1935',
  /** RTMP base for media-worker to read from SRS (Docker: rtmp://srs:1935). */
  srsRtmpReadBase: process.env.SRS_RTMP_READ_BASE ?? process.env.SRS_RTMP_FORWARD_BASE ?? 'rtmp://127.0.0.1:1935',
  srsHttpApiUrl: process.env.SRS_HTTP_API_URL ?? 'http://localhost:1985',
  minioEndpoint: process.env.MINIO_ENDPOINT ?? 'localhost:9000',
  minioAccessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  minioSecretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  minioUseSsl: process.env.MINIO_USE_SSL === 'true',
  minioPublicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'localhost:9000',
  storageSecretKey: process.env.STORAGE_SECRET_KEY ?? '',
};
