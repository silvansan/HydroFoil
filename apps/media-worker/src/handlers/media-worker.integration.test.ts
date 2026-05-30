import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { StorageClient } from '@hydrofoil/storage';
import { describe, expect, it, vi } from 'vitest';

import { processFinalizeRecording } from './finalize-recording';
import { processGenerateAudioAsset } from './generate-audio-asset';
import { transcodeFlvToHls } from './transcode-hls';
import { ObjectStorageService } from '../services/object-storage';

const execFileAsync = promisify(execFile);
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === 'true' &&
  process.env.RUN_FFMPEG_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

async function createSampleFlv(filePath: string) {
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=160x90:rate=25',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=1000:sample_rate=44100',
      '-t',
      '1',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-c:a',
      'aac',
      filePath,
    ],
    { timeout: 60_000 }
  );
}

function createStorageClient() {
  return new StorageClient({
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    useSSL: process.env.MINIO_USE_SSL === 'true',
    publicEndpoint: process.env.MINIO_PUBLIC_ENDPOINT ?? 'localhost:9000',
    pathStyle: true,
  });
}

describeIntegration('media-worker external tool integration', () => {
  it('transcodes a DVR FLV into an HLS package with ffmpeg', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'hydrofoil-hls-it-'));
    const source = path.join(tmp, 'source.flv');
    let hlsDir: string | null = null;

    try {
      await createSampleFlv(source);
      const result = await transcodeFlvToHls(source);
      hlsDir = result.dir;

      expect(result.manifest.endsWith('index.m3u8')).toBe(true);
      await expect(stat(result.manifest)).resolves.toBeTruthy();
    } finally {
      if (hlsDir) await rm(hlsDir, { recursive: true, force: true });
      await rm(tmp, { recursive: true, force: true });
    }
  }, 90_000);

  it('discovers an SRS DVR FLV, uploads it to MinIO, and completes the recording', async () => {
    const originalDvrRoot = process.env.SRS_DVR_ROOT;
    const root = await mkdtemp(path.join(os.tmpdir(), 'hydrofoil-finalize-it-'));
    const appDir = path.join(root, 'dvr', 'live');
    const source = path.join(appDir, 'main-key.1234.flv');
    const bucket = `hydrofoil-worker-it-${Date.now()}`;
    const objectKey = 'recordings/main-key.flv';
    const storageClient = createStorageClient();

    try {
      process.env.SRS_DVR_ROOT = root;
      await mkdir(appDir, { recursive: true });
      await createSampleFlv(source);

      const repos = {
        recordingAssets: {
          findById: vi.fn().mockResolvedValue({
            id: 'recording-1',
            organizationId: 'org-1',
            liveSessionId: 'session-1',
            recordingPolicyId: 'policy-1',
            status: 'finalizing',
            storageLocation: bucket,
            objectKey,
            fileSize: 0,
            startedAt: new Date(Date.now() - 1000),
          }),
          markFailed: vi.fn(),
          completeFinalize: vi.fn().mockImplementation(
            async (_orgId: string, _id: string, params: Record<string, unknown>) => ({
              id: 'recording-1',
              ...params,
            })
          ),
        },
        recordingPolicies: {
          findById: vi.fn().mockResolvedValue({ remuxToMp4: false }),
        },
      };

      const result = await processFinalizeRecording(
        {
          id: 'job-1',
          data: {
            organizationId: 'org-1',
            recordingAssetId: 'recording-1',
            liveSessionId: 'session-1',
            objectKey,
            gatewayApp: 'live',
            streamKey: 'main-key',
          },
        } as any,
        repos as any,
        new ObjectStorageService()
      );

      expect(result.success).toBe(true);
      expect(repos.recordingAssets.completeFinalize).toHaveBeenCalledWith(
        'org-1',
        'recording-1',
        expect.objectContaining({ status: 'ready', objectKey })
      );
      await expect(storageClient.getObjectStat(bucket, objectKey)).resolves.toMatchObject({
        key: objectKey,
        type: 'object',
      });
    } finally {
      const objects = await storageClient.listObjects(bucket, { recursive: true }).catch(() => []);
      await Promise.all(objects.map((item) => storageClient.deleteObject(bucket, item.key)));
      process.env.SRS_DVR_ROOT = originalDvrRoot;
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);

  it('generates an audio derivative from an SRS DVR FLV with ffmpeg', async () => {
    const originalDvrRoot = process.env.SRS_DVR_ROOT;
    const root = await mkdtemp(path.join(os.tmpdir(), 'hydrofoil-audio-it-'));
    const appDir = path.join(root, 'dvr', 'live');
    const source = path.join(appDir, 'main-key.1234.flv');
    const storage = {
      uploadFile: vi.fn().mockResolvedValue({ bucket: 'audio', objectKey: 'audio/main.mp3' }),
    };

    try {
      process.env.SRS_DVR_ROOT = root;
      await mkdir(appDir, { recursive: true });
      await createSampleFlv(source);

      const repos = {
        generatedAudioAssets: {
          findById: vi.fn().mockResolvedValue({
            id: 'audio-1',
            status: 'pending',
            fileSize: 0,
            duration: 0,
          }),
          beginProcessing: vi.fn().mockResolvedValue({ id: 'audio-1' }),
          complete: vi.fn().mockResolvedValue({ id: 'audio-1', status: 'ready' }),
          markFailed: vi.fn(),
        },
      };

      const result = await processGenerateAudioAsset(
        {
          id: 'job-1',
          data: {
            organizationId: 'org-1',
            audioAssetId: 'audio-1',
            codec: 'mp3',
            container: 'mp3',
            storageLocation: 'audio',
            objectKey: 'audio/main.mp3',
            liveSessionId: 'session-1',
            trigger: 'live',
            gatewayApp: 'live',
            streamKey: 'main-key',
            durationSec: 1,
          },
        } as any,
        repos as any,
        storage as any
      );

      expect(result.success).toBe(true);
      expect(storage.uploadFile).toHaveBeenCalledWith(
        'audio',
        'audio/main.mp3',
        expect.stringMatching(/audio-audio-1\.mp3$/),
        { 'Content-Type': 'audio/mpeg' }
      );
      expect(repos.generatedAudioAssets.complete).toHaveBeenCalledWith(
        'org-1',
        'audio-1',
        expect.objectContaining({ duration: 1, objectKey: 'audio/main.mp3' })
      );
    } finally {
      process.env.SRS_DVR_ROOT = originalDvrRoot;
      await rm(root, { recursive: true, force: true });
    }
  }, 120_000);
});
