import type { Repositories } from '@hydrofoil/db';
import { decryptStorageSecret, resolveMinioObject, StorageClient } from '@hydrofoil/storage';
import { config } from '../config';

let client: StorageClient | null = null;

export function getStorageClient(): StorageClient {
  if (!client) {
    client = new StorageClient({
      endpoint: config.minioEndpoint,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
      useSSL: config.minioUseSsl,
      publicEndpoint: config.minioPublicEndpoint,
    });
  }
  return client;
}

export interface RecordingStorageRef {
  storageLocation: string;
  objectKey: string;
  metadata?: Record<string, unknown> | null;
}

type StorageRepos = Pick<Repositories, 'storageLocations'>;

interface ResolvedStorageObject {
  storage: StorageClient;
  bucket: string;
  objectKey: string;
}

function parseStorageLocationRef(
  storageLocation: string
): { organizationId: string; storageLocationId: string } | null {
  const match = storageLocation.match(/^location:([^:]+):([^:]+)$/);
  if (!match) return null;
  return { organizationId: match[1]!, storageLocationId: match[2]! };
}

export async function resolveStorageObject(
  storageLocation: string,
  objectKey: string,
  repos?: StorageRepos
): Promise<ResolvedStorageObject> {
  const ref = parseStorageLocationRef(storageLocation);
  if (!ref) {
    const resolved = resolveMinioObject(storageLocation, objectKey);
    return { storage: getStorageClient(), bucket: resolved.bucket, objectKey: resolved.objectKey };
  }

  if (!repos) {
    throw new Error('Storage location references require repositories');
  }

  const location = await repos.storageLocations.findByIdWithSecrets(
    ref.organizationId,
    ref.storageLocationId
  );
  if (!location) {
    throw new Error(`Storage location ${ref.storageLocationId} not found`);
  }

  return {
    storage: new StorageClient({
      endpoint: location.endpoint ?? config.minioEndpoint,
      accessKey:
        decryptStorageSecret(location.accessKey, config.storageSecretKey) ?? config.minioAccessKey,
      secretKey:
        decryptStorageSecret(location.secretKey, config.storageSecretKey) ?? config.minioSecretKey,
      useSSL: location.useSsl ?? config.minioUseSsl,
      publicEndpoint: location.publicEndpoint ?? config.minioPublicEndpoint,
      region: location.region,
      pathStyle: location.pathStyle ?? true,
    }),
    bucket: String(location.bucketName),
    objectKey: objectKey.replace(/^\/+/, ''),
  };
}

export function minioObjectForRecording(recording: RecordingStorageRef): {
  bucket: string;
  objectKey: string;
} {
  return resolveMinioObject(recording.storageLocation, recording.objectKey);
}

export function hlsManifestKey(recording: RecordingStorageRef): string | undefined {
  const key = recording.metadata?.hlsManifestKey;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

export async function signedPlaybackUrl(
  recording: RecordingStorageRef,
  objectKeyOverride?: string,
  expirySeconds = 7 * 24 * 60 * 60,
  repos?: StorageRepos
): Promise<string> {
  const objectKey =
    objectKeyOverride ??
    hlsManifestKey(recording) ??
    minioObjectForRecording(recording).objectKey;

  const resolved = await resolveStorageObject(recording.storageLocation, objectKey, repos);
  return resolved.storage.getSignedUrl(resolved.bucket, resolved.objectKey, expirySeconds);
}

/** Remove FLV + optional HLS segments from MinIO for a catalog row. */
export async function deleteRecordingFromStorage(
  recording: RecordingStorageRef,
  repos?: StorageRepos
): Promise<void> {
  const resolved = await resolveStorageObject(
    recording.storageLocation,
    recording.objectKey,
    repos
  );
  try {
    await resolved.storage.deleteObject(resolved.bucket, resolved.objectKey);
  } catch {
    // object may already be gone
  }

  const manifestKey = hlsManifestKey(recording);
  if (!manifestKey) return;

  const hlsResolved = await resolveStorageObject(recording.storageLocation, manifestKey, repos);
  const prefix = hlsResolved.objectKey.replace(/index\.m3u8$/i, '');
  const objects = await hlsResolved.storage.listObjects(hlsResolved.bucket, prefix);

  for (const obj of objects) {
    try {
      await hlsResolved.storage.deleteObject(hlsResolved.bucket, obj.key);
    } catch {
      // best effort
    }
  }
}
