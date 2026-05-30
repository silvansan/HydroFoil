import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';
import { decryptStorageSecret, encryptStorageSecret } from '../lib/storage-secrets';
import { config } from '../config';
import { StorageClient, type StorageConfig } from '@hydrofoil/storage';

const createStorageSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['minio', 'local', 's3']),
  bucketName: z.string().min(1),
  prefixPath: z.string().optional(),
  isDefault: z.boolean().optional(),
  endpoint: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  useSsl: z.boolean().optional(),
  publicEndpoint: z.string().min(1).optional(),
  pathStyle: z.boolean().optional(),
  accessKey: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
});

const moveObjectSchema = z.object({
  destinationObjectKey: z.string().min(1),
});

function assertObjectStorageLocation(location: { type: string }) {
  if (location.type !== 'minio' && location.type !== 's3') {
    throw new BadRequestError('Object operations are only supported for MinIO/S3 locations');
  }
}

function normalizePrefix(prefix: unknown): string {
  return String(prefix ?? '').replace(/^\/+|\/+$/g, '');
}

function resolveLocationObjectKey(location: { prefixPath?: string | null }, objectKey: string): string {
  const basePrefix = normalizePrefix(location.prefixPath);
  const cleanKey = objectKey.replace(/^\/+/, '');
  if (!basePrefix || cleanKey === basePrefix || cleanKey.startsWith(`${basePrefix}/`)) {
    return cleanKey;
  }
  return `${basePrefix}/${cleanKey}`;
}

type ObjectStorageLocation = NonNullable<
  Awaited<ReturnType<AppContext['repos']['storageLocations']['findByIdWithSecrets']>>
>;

async function loadObjectStorageLocation(ctx: AppContext, id: string): Promise<ObjectStorageLocation> {
  const location = await ctx.repos.storageLocations.findByIdWithSecrets(ctx.organizationId, id);
  if (!location) throw new NotFoundError('Storage location not found');
  assertObjectStorageLocation(location);
  return location;
}

function storageClientForLocation(location: ObjectStorageLocation): StorageClient {
  const accessKey = decryptStorageSecret(location.accessKey, config.storageSecretKey);
  const secretKey = decryptStorageSecret(location.secretKey, config.storageSecretKey);
  const storageConfig: StorageConfig = {
    endpoint: location.endpoint ?? config.minioEndpoint,
    accessKey: accessKey ?? config.minioAccessKey,
    secretKey: secretKey ?? config.minioSecretKey,
    useSSL: location.useSsl ?? config.minioUseSsl,
    publicEndpoint: location.publicEndpoint ?? config.minioPublicEndpoint,
    region: location.region,
    pathStyle: location.pathStyle ?? true,
  };

  if (!storageConfig.endpoint || !storageConfig.accessKey || !storageConfig.secretKey) {
    throw new BadRequestError('Storage location is missing endpoint or credentials');
  }

  return new StorageClient(storageConfig);
}

export function createStorageLocationsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.storageLocations.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id/objects',
    asyncHandler(async (req, res) => {
      const location = await loadObjectStorageLocation(ctx, req.params.id);

      const subPrefix = typeof req.query.prefix === 'string' ? req.query.prefix.trim() : '';
      const basePrefix = normalizePrefix(location.prefixPath);
      const combined = [basePrefix, subPrefix.replace(/^\/+|\/+$/g, '')]
        .filter(Boolean)
        .join('/');

      const storage = storageClientForLocation(location);
      const objects = await storage.listObjects(
        String(location.bucketName),
        { prefix: combined ? `${combined}/` : undefined, recursive: false, limit: 500 }
      );

      objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      res.json({
        prefix: combined,
        bucketName: location.bucketName,
        items: objects.slice(0, 500),
        total: objects.length,
        truncated: objects.length > 500,
      });
    })
  );

  router.get(
    '/:id/objects/:objectKey(*)/stat',
    asyncHandler(async (req, res) => {
      const location = await loadObjectStorageLocation(ctx, req.params.id);
      const objectKey = resolveLocationObjectKey(location, req.params.objectKey);
      const metadata = await storageClientForLocation(location).getObjectStat(String(location.bucketName), objectKey);
      res.json({ bucketName: location.bucketName, ...metadata });
    })
  );

  router.get(
    '/:id/objects/:objectKey(*)/signed-url',
    asyncHandler(async (req, res) => {
      const location = await loadObjectStorageLocation(ctx, req.params.id);
      const objectKey = resolveLocationObjectKey(location, req.params.objectKey);
      const expirySeconds =
        typeof req.query.expirySeconds === 'string'
          ? Math.min(7 * 24 * 60 * 60, Math.max(1, Number(req.query.expirySeconds)))
          : 7 * 24 * 60 * 60;
      if (!Number.isFinite(expirySeconds)) {
        throw new BadRequestError('expirySeconds must be a number');
      }

      const url = await storageClientForLocation(location).getSignedUrl(
        String(location.bucketName),
        objectKey,
        expirySeconds
      );
      res.json({ bucketName: location.bucketName, objectKey, expirySeconds, url });
    })
  );

  router.post(
    '/:id/objects/:objectKey(*)/move',
    asyncHandler(async (req, res) => {
      const parsed = moveObjectSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const location = await loadObjectStorageLocation(ctx, req.params.id);
      const sourceObjectKey = resolveLocationObjectKey(location, req.params.objectKey);
      const destinationObjectKey = resolveLocationObjectKey(
        location,
        parsed.data.destinationObjectKey
      );

      const object = await storageClientForLocation(location).moveObject(
        String(location.bucketName),
        sourceObjectKey,
        String(location.bucketName),
        destinationObjectKey
      );

      res.json({
        bucketName: location.bucketName,
        sourceObjectKey,
        destinationObjectKey,
        object,
      });
    })
  );

  router.delete(
    '/:id/objects/:objectKey(*)',
    asyncHandler(async (req, res) => {
      const location = await loadObjectStorageLocation(ctx, req.params.id);
      const objectKey = resolveLocationObjectKey(location, req.params.objectKey);
      await storageClientForLocation(location).deleteObject(String(location.bucketName), objectKey);
      res.status(204).end();
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const location = await ctx.repos.storageLocations.findById(
        ctx.organizationId,
        req.params.id
      );
      if (!location) throw new NotFoundError('Storage location not found');
      res.json(location);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createStorageSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);
      if (parsed.data.type === 's3') {
        if (!parsed.data.endpoint || !parsed.data.accessKey || !parsed.data.secretKey) {
          throw new BadRequestError('S3 storage locations require endpoint, access key, and secret key');
        }
      }
      const data = {
        ...parsed.data,
        accessKey: encryptStorageSecret(parsed.data.accessKey, config.storageSecretKey),
        secretKey: encryptStorageSecret(parsed.data.secretKey, config.storageSecretKey),
      };
      res.status(201).json(await ctx.repos.storageLocations.create(ctx.organizationId, data));
    })
  );

  return router;
}
