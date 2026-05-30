import type { Repositories } from '@hydrofoil/db';
import { decryptStorageSecret, StorageClient, resolveMinioObject } from '@hydrofoil/storage';

interface StorageTarget {
  storage: StorageClient;
  bucket: string;
  objectKey: string;
  shouldEnsureBucket: boolean;
}

function createStorageClient(): StorageClient {
  return new StorageClient({
    endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT,
  });
}

function parseStorageLocationRef(
  storageLocation: string
): { organizationId: string; storageLocationId: string } | null {
  const match = storageLocation.match(/^location:([^:]+):([^:]+)$/);
  if (!match) return null;
  return { organizationId: match[1]!, storageLocationId: match[2]! };
}

export class ObjectStorageService {
  constructor(
    private readonly storage = createStorageClient(),
    private readonly repos?: Pick<Repositories, 'storageLocations'>
  ) {}

  resolve(storageLocation: string, objectKey: string) {
    return resolveMinioObject(storageLocation, objectKey);
  }

  private async resolveTarget(storageLocation: string, objectKey: string): Promise<StorageTarget> {
    const ref = parseStorageLocationRef(storageLocation);
    if (!ref) {
      const target = this.resolve(storageLocation, objectKey);
      return {
        storage: this.storage,
        bucket: target.bucket,
        objectKey: target.objectKey,
        shouldEnsureBucket: true,
      };
    }

    if (!this.repos) {
      throw new Error('Storage location references require repositories in ObjectStorageService');
    }

    const location = await this.repos.storageLocations.findByIdWithSecrets(
      ref.organizationId,
      ref.storageLocationId
    );
    if (!location) {
      throw new Error(`Storage location ${ref.storageLocationId} not found`);
    }

    const endpoint = location.endpoint ?? process.env.MINIO_ENDPOINT ?? 'localhost:9000';
    const accessKey =
      decryptStorageSecret(location.accessKey, process.env.STORAGE_SECRET_KEY ?? '') ??
      process.env.MINIO_ACCESS_KEY ??
      'minioadmin';
    const secretKey =
      decryptStorageSecret(location.secretKey, process.env.STORAGE_SECRET_KEY ?? '') ??
      process.env.MINIO_SECRET_KEY ??
      'minioadmin';

    return {
      storage: new StorageClient({
        endpoint,
        accessKey,
        secretKey,
        useSSL: location.useSsl ?? process.env.MINIO_USE_SSL === 'true',
        publicEndpoint: location.publicEndpoint ?? process.env.MINIO_PUBLIC_ENDPOINT,
        region: location.region,
        pathStyle: location.pathStyle ?? true,
      }),
      bucket: String(location.bucketName),
      objectKey: objectKey.replace(/^\/+/, ''),
      shouldEnsureBucket: location.type === 'minio',
    };
  }

  async ensureLocation(storageLocation: string, objectKey: string) {
    const target = await this.resolveTarget(storageLocation, objectKey);
    if (target.shouldEnsureBucket) {
      await target.storage.ensureBucket(target.bucket);
    }
    return { bucket: target.bucket, objectKey: target.objectKey };
  }

  async uploadFile(
    storageLocation: string,
    objectKey: string,
    localPath: string,
    metadata?: Record<string, string>
  ) {
    const target = await this.resolveTarget(storageLocation, objectKey);
    if (target.shouldEnsureBucket) {
      await target.storage.ensureBucket(target.bucket);
    }
    await target.storage.uploadFile(target.bucket, target.objectKey, localPath, metadata);
    return { bucket: target.bucket, objectKey: target.objectKey };
  }

  async downloadFile(storageLocation: string, objectKey: string, localPath: string) {
    const target = await this.resolveTarget(storageLocation, objectKey);
    await target.storage.downloadFile(target.bucket, target.objectKey, localPath);
    return { bucket: target.bucket, objectKey: target.objectKey };
  }

  async deleteObject(storageLocation: string, objectKey: string) {
    const target = await this.resolveTarget(storageLocation, objectKey);
    await target.storage.deleteObject(target.bucket, target.objectKey);
    return { bucket: target.bucket, objectKey: target.objectKey };
  }
}

export function createObjectStorageService(repos?: Pick<Repositories, 'storageLocations'>) {
  return new ObjectStorageService(createStorageClient(), repos);
}
