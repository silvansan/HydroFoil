import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { StorageClient } from './index';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

function createClient() {
  return new StorageClient({
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'localhost:9000',
    pathStyle: true,
  });
}

describeIntegration('StorageClient MinIO integration', () => {
  it('uploads, browses, stats, signs, moves, downloads, and deletes objects', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'hydrofoil-storage-'));
    const client = createClient();
    const bucket = `hydrofoil-it-${Date.now()}`;
    const sourceKey = 'incoming/sample.txt';
    const movedKey = 'archive/sample.txt';
    const sourceFile = path.join(tmp, 'sample.txt');
    const downloadedFile = path.join(tmp, 'downloaded.txt');

    try {
      await writeFile(sourceFile, 'hydrofoil-storage-integration');
      await client.ensureBucket(bucket);
      await client.uploadFile(bucket, sourceKey, sourceFile, { 'Content-Type': 'text/plain' });

      const listed = await client.listObjects(bucket, { prefix: 'incoming/', recursive: true });
      expect(listed.some((item) => item.key === sourceKey && item.type === 'object')).toBe(true);

      const stat = await client.getObjectStat(bucket, sourceKey);
      expect(stat.size).toBeGreaterThan(0);
      expect(stat.contentType).toBe('text/plain');

      const signedUrl = await client.getSignedUrl(bucket, sourceKey, 60);
      expect(signedUrl).toContain(bucket);
      expect(signedUrl).toContain(encodeURIComponent(sourceKey).replace(/%2F/g, '/'));

      const moved = await client.moveObject(bucket, sourceKey, bucket, movedKey);
      expect(moved.key).toBe(movedKey);

      await client.downloadFile(bucket, movedKey, downloadedFile);
      await expect(readFile(downloadedFile, 'utf8')).resolves.toBe('hydrofoil-storage-integration');

      await client.deleteObject(bucket, movedKey);
      const afterDelete = await client.listObjects(bucket, { recursive: true });
      expect(afterDelete.some((item) => item.key === movedKey)).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
