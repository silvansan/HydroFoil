import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import type { Repositories } from '@hydrofoil/db';
import type { GenerateAudioAssetJob } from '@hydrofoil/queue';
import type { Job } from 'bull';
import pino from 'pino';

import { findSrsDvrFile } from './finalize-recording';
import { ObjectStorageService } from '../services/object-storage';

const logger = pino({ name: 'generate-audio-asset' });

function outputExtension(codec: string, container: string): string {
  if (container === 'ogg' || codec === 'opus') return 'ogg';
  if (codec === 'aac' || container === 'aac') return 'aac';
  return 'mp3';
}

function ffmpegAudioArgs(inputPath: string, outputPath: string, codec: string): string[] {
  const base = ['-nostats', '-loglevel', 'warning', '-y', '-i', inputPath, '-vn'];

  switch (codec) {
    case 'aac':
      return [...base, '-c:a', 'aac', '-b:a', '128k', outputPath];
    case 'opus':
      return [...base, '-c:a', 'libopus', '-b:a', '96k', outputPath];
    case 'mp3':
    default:
      return [...base, '-c:a', 'libmp3lame', '-b:a', '128k', outputPath];
  }
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function resolveSourceFlv(
  job: GenerateAudioAssetJob,
  repos: Repositories,
  storage: ObjectStorageService
): Promise<string> {
  if (job.trigger === 'post-recording' && job.recordingAssetId) {
    const recording = await repos.recordingAssets.findById(
      job.organizationId,
      job.recordingAssetId
    );
    if (!recording) {
      throw new Error(`Recording asset ${job.recordingAssetId} not found for audio extraction`);
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hf-audio-'));
    const localPath = path.join(tmpDir, 'source.flv');
    await storage.downloadFile(String(recording.storageLocation), String(recording.objectKey), localPath);
    return localPath;
  }

  const gatewayApp = job.gatewayApp ?? 'live';
  const streamKey = job.streamKey ?? '';
  const localPath = await findSrsDvrFile(gatewayApp, streamKey);
  if (!localPath) {
    throw new Error(`SRS DVR source not found for ${gatewayApp}/${streamKey}`);
  }
  return localPath;
}

export async function processGenerateAudioAsset(
  job: Job<GenerateAudioAssetJob>,
  repos: Repositories,
  storage = new ObjectStorageService()
): Promise<{ success: boolean; data?: unknown }> {
  const data = job.data;
  logger.info({ jobId: job.id, audioAssetId: data.audioAssetId, codec: data.codec }, 'Generating audio asset');

  const asset = await repos.generatedAudioAssets.findById(data.organizationId, data.audioAssetId);
  if (!asset) {
    throw new Error(`Generated audio asset ${data.audioAssetId} not found`);
  }

  if (asset.status === 'ready' && asset.fileSize > 0) {
    return { success: true, data: { skipped: true } };
  }

  const processing = await repos.generatedAudioAssets.beginProcessing(data.organizationId, data.audioAssetId);
  if (!processing) {
    return { success: true, data: { skipped: true, note: 'already processing or ready' } };
  }

  let sourcePath: string | null = null;
  let outputPath: string | null = null;
  let tempDir: string | null = null;

  try {
    sourcePath = await resolveSourceFlv(data, repos, storage);
    if (sourcePath.includes(os.tmpdir())) {
      tempDir = path.dirname(sourcePath);
    }

    const ext = outputExtension(data.codec, data.container);
    outputPath = path.join(tempDir ?? os.tmpdir(), `audio-${data.audioAssetId}.${ext}`);
    await runFfmpeg(ffmpegAudioArgs(sourcePath, outputPath, data.codec));

    const stat = await fs.stat(outputPath);
    const contentType =
      ext === 'mp3' ? 'audio/mpeg' : ext === 'aac' ? 'audio/aac' : 'audio/ogg';
    const target = await storage.uploadFile(data.storageLocation, data.objectKey, outputPath, {
      'Content-Type': contentType,
    });

    const durationSec = data.durationSec ?? asset.duration ?? 0;
    const finalized = await repos.generatedAudioAssets.complete(data.organizationId, data.audioAssetId, {
      fileSize: stat.size,
      duration: durationSec,
      objectKey: data.objectKey,
    });

    logger.info(
      { audioAssetId: data.audioAssetId, bucket: target.bucket, objectKey: target.objectKey, bytes: stat.size },
      'Audio asset uploaded'
    );

    return { success: true, data: { asset: finalized } };
  } catch (err) {
    await repos.generatedAudioAssets.markFailed(data.organizationId, data.audioAssetId);
    throw err;
  } finally {
    if (outputPath) await fs.unlink(outputPath).catch(() => undefined);
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
