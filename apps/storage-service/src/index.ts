// HydroFoil Storage Service

import express, { type NextFunction, type Request, type Response } from 'express';
import pino from 'pino';
import { z } from 'zod';
import { StorageClient, StorageConfig } from '@hydrofoil/storage';

const logger = pino();
const app = express();

app.use(express.json());

const storageServiceApiKey = process.env.STORAGE_SERVICE_API_KEY?.trim();

function requireStorageServiceApiKey(req: Request, res: Response, next: NextFunction) {
  if (!storageServiceApiKey) {
    next();
    return;
  }

  const provided =
    req.header('x-api-key') ??
    (req.header('authorization')?.startsWith('Bearer ')
      ? req.header('authorization')!.slice('Bearer '.length).trim()
      : undefined);

  if (provided !== storageServiceApiKey) {
    res.status(401).json({ error: 'Unauthorized', timestamp: new Date().toISOString() });
    return;
  }

  next();
}

// Initialize storage client
const storageConfig: StorageConfig = {
  endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  useSSL: process.env.MINIO_USE_SSL === 'true',
  region: process.env.MINIO_REGION,
  publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
};

const storage = new StorageClient(storageConfig);

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true' || value === '1' || value === true) return true;
  if (value === 'false' || value === '0' || value === false) return false;
  throw new HttpError(400, 'Expected boolean query value');
}

function parsePositiveInteger(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${name} must be a positive integer`);
  }
  return parsed;
}

const bucketSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/, 'Invalid bucket name');

const objectKeySchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Object key contains control characters');

const moveBodySchema = z.object({
  destinationBucket: bucketSchema.optional(),
  destinationObjectName: objectKeySchema,
});

function validatedBucket(rawBucket: string): string {
  const parsed = bucketSchema.safeParse(rawBucket);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid bucket');
  return parsed.data;
}

function validatedObjectKey(rawObjectName: string | undefined): string {
  const parsed = objectKeySchema.safeParse(rawObjectName ?? '');
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid object name');
  }
  return parsed.data;
}

interface StorageErrorLike {
  code?: string;
  statusCode?: number;
  message?: string;
}

function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;

  const storageError = error as StorageErrorLike;
  if (storageError.code === 'NoSuchBucket') {
    return new HttpError(404, 'Bucket not found');
  }
  if (storageError.code === 'NoSuchKey' || storageError.code === 'NotFound') {
    return new HttpError(404, 'Object not found');
  }
  if (storageError.code === 'AccessDenied' || storageError.statusCode === 403) {
    return new HttpError(403, 'Storage access denied');
  }
  if (storageError.message) {
    return new HttpError(500, storageError.message);
  }
  return new HttpError(500, 'Storage operation failed');
}

// Health check (unauthenticated for probes)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(requireStorageServiceApiKey);

// List objects in bucket
app.get(
  '/api/buckets/:bucket/objects',
  asyncHandler(async (req, res) => {
    const bucket = validatedBucket(req.params.bucket);
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : undefined;
    const recursive = parseBoolean(req.query.recursive) ?? false;
    const limit = parsePositiveInteger(req.query.limit, 'limit') ?? 500;

    const objects = await storage.listObjects(bucket, { prefix, recursive, limit });
    res.json({
      bucket,
      prefix: prefix ?? '',
      recursive,
      items: objects,
      total: objects.length,
      truncated: objects.length >= limit,
    });
  })
);

// Get signed URL for object
app.get(
  '/api/buckets/:bucket/objects/:objectName(*)/signed-url',
  asyncHandler(async (req, res) => {
    const bucket = validatedBucket(req.params.bucket);
    const objectName = validatedObjectKey(req.params.objectName);
    const expirySeconds = parsePositiveInteger(req.query.expirySeconds, 'expirySeconds') ?? 7 * 24 * 60 * 60;
    if (expirySeconds > 7 * 24 * 60 * 60) {
      throw new HttpError(400, 'expirySeconds cannot exceed 604800');
    }

    const url = await storage.getSignedUrl(bucket, objectName, expirySeconds);
    res.json({ bucket, objectName, expirySeconds, url });
  })
);

// Get object metadata/stat
app.get(
  ['/api/buckets/:bucket/objects/:objectName(*)/metadata', '/api/buckets/:bucket/objects/:objectName(*)/stat'],
  asyncHandler(async (req, res) => {
    const bucket = validatedBucket(req.params.bucket);
    const objectName = validatedObjectKey(req.params.objectName);

    const metadata = await storage.getObjectStat(bucket, objectName);
    res.json({ bucket, ...metadata });
  })
);

// Move object. This is implemented as S3 copy followed by source delete.
app.post(
  '/api/buckets/:bucket/objects/:objectName(*)/move',
  asyncHandler(async (req, res) => {
    const sourceBucket = validatedBucket(req.params.bucket);
    const sourceObjectName = validatedObjectKey(req.params.objectName);
    const parsed = moveBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid move request');
    }

    const destinationBucket = parsed.data.destinationBucket ?? sourceBucket;
    const metadata = await storage.moveObject(
      sourceBucket,
      sourceObjectName,
      destinationBucket,
      parsed.data.destinationObjectName
    );

    res.json({
      source: { bucket: sourceBucket, objectName: sourceObjectName },
      destination: { bucket: destinationBucket, objectName: parsed.data.destinationObjectName },
      object: metadata,
    });
  })
);

// Delete object
app.delete(
  '/api/buckets/:bucket/objects/:objectName(*)',
  asyncHandler(async (req, res) => {
    const bucket = validatedBucket(req.params.bucket);
    const objectName = validatedObjectKey(req.params.objectName);

    await storage.deleteObject(bucket, objectName);
    res.json({ success: true, bucket, objectName });
  })
);

// Error handling
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const httpError = toHttpError(err);
  if (httpError.statusCode >= 500) {
    logger.error(err, 'Storage service error');
  } else {
    logger.warn(err, 'Storage service request rejected');
  }
  res.status(httpError.statusCode).json({
    error: httpError.message,
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  logger.info(`Storage Service listening on port ${PORT}`);
});

export default app;
