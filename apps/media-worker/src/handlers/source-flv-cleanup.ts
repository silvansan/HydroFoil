import type { Repositories } from '@hydrofoil/db';
import pino from 'pino';

import { ObjectStorageService } from '../services/object-storage';

const logger = pino({ name: 'source-flv-cleanup' });

export async function cleanupExpiredSourceFlvCopies(
  repos: Repositories,
  storage: ObjectStorageService,
  limit = 100
): Promise<{ scanned: number; cleaned: number; failed: number }> {
  const recordings = await repos.recordingAssets.listExpiredSourceFlvCopies(limit);
  let cleaned = 0;
  let failed = 0;

  for (const recording of recordings) {
    const metadata =
      recording.metadata && typeof recording.metadata === 'object'
        ? (recording.metadata as Record<string, unknown>)
        : {};
    const sourceFlvObjectKey = metadata.sourceFlvObjectKey;

    if (typeof sourceFlvObjectKey !== 'string' || sourceFlvObjectKey.length === 0) {
      await repos.recordingAssets.markSourceFlvCleaned(
        String(recording.organizationId),
        String(recording.id)
      );
      cleaned += 1;
      continue;
    }

    try {
      const deleted = await storage.deleteObject(
        String(recording.storageLocation),
        sourceFlvObjectKey
      );
      await repos.recordingAssets.markSourceFlvCleaned(
        String(recording.organizationId),
        String(recording.id)
      );
      cleaned += 1;
      logger.info(
        { recordingId: recording.id, bucket: deleted.bucket, objectKey: deleted.objectKey },
        'Expired source FLV copy deleted'
      );
    } catch (err) {
      failed += 1;
      logger.warn(
        { err, recordingId: recording.id, objectKey: sourceFlvObjectKey },
        'Failed to delete expired source FLV copy'
      );
    }
  }

  return { scanned: recordings.length, cleaned, failed };
}

export function startSourceFlvCleanupLoop(
  repos: Repositories,
  storage: ObjectStorageService,
  intervalMs = 60 * 60 * 1000
): NodeJS.Timeout | null {
  if (intervalMs <= 0) {
    logger.info('Source FLV cleanup loop disabled');
    return null;
  }

  const run = () => {
    cleanupExpiredSourceFlvCopies(repos, storage).catch((err) => {
      logger.warn({ err }, 'Source FLV cleanup pass failed');
    });
  };

  run();
  return setInterval(run, intervalMs);
}
