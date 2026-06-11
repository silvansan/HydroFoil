import { StorageClient, type StorageConfig } from '@hydrofoil/storage';

import { config } from '../config';
import { BadRequestError } from '../errors';
import { decryptStorageSecret } from './storage-secrets';

export type ObjectStorageLocation = {
  type: string;
  bucketName: string;
  endpoint?: string | null;
  region?: string | null;
  useSsl?: boolean | null;
  publicEndpoint?: string | null;
  pathStyle?: boolean | null;
  accessKey?: string | null;
  secretKey?: string | null;
};

export function assertObjectStorageLocation(location: { type: string }) {
  if (location.type !== 'minio' && location.type !== 's3') {
    throw new BadRequestError('Object operations are only supported for MinIO/S3 locations');
  }
}

export function storageClientForLocation(location: ObjectStorageLocation): StorageClient {
  const accessKey = decryptStorageSecret(location.accessKey ?? undefined, config.storageSecretKey);
  const secretKey = decryptStorageSecret(location.secretKey ?? undefined, config.storageSecretKey);
  const storageConfig: StorageConfig = {
    endpoint: location.endpoint ?? config.minioEndpoint,
    accessKey: accessKey ?? config.minioAccessKey,
    secretKey: secretKey ?? config.minioSecretKey,
    useSSL: location.useSsl ?? config.minioUseSsl,
    publicEndpoint: location.publicEndpoint ?? config.minioPublicEndpoint,
    region: location.region ?? undefined,
    pathStyle: location.pathStyle ?? true,
  };

  if (!storageConfig.endpoint || !storageConfig.accessKey || !storageConfig.secretKey) {
    throw new BadRequestError('Storage location is missing endpoint or credentials');
  }

  return new StorageClient(storageConfig);
}
