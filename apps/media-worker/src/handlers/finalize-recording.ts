import fs from 'node:fs/promises';
import path from 'node:path';

import type { Repositories } from '@hydrofoil/db';
import { scheduleAudioDerivatives } from '@hydrofoil/db';
import type { FinalizeRecordingJob } from '@hydrofoil/queue';
import type { GenerateAudioAssetJob } from '@hydrofoil/queue';
import type { Job } from 'bull';
import pino from 'pino';

import {
  cleanupTranscodeDir,
  hlsObjectPrefixFromFlvKey,
  transcodeFlvToHls,
} from './transcode-hls';
import { mp4ObjectKeyFromFlvKey, remuxFlvToMp4 } from './remux-mp4';
import { ObjectStorageService } from '../services/object-storage';

const logger = pino({ name: 'finalize-recording' });

const TRANSCODE_HLS = process.env.RECORDING_TRANSCODE_HLS !== 'false';

function srsDvrRoot(): string {
  return process.env.SRS_DVR_ROOT ?? '/srs-dvr';
}

function retainUntil(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** SRS writes dvr/[app]/[stream].[timestamp].flv — pick newest matching stream after recording start. */
export async function findSrsDvrFileInRoot(
  root: string,
  gatewayApp: string,
  streamKey: string,
  notBeforeMs?: number
): Promise<string | null> {
  const app = gatewayApp.replace(/^\/+|\/+$/g, '') || 'live';
  const stream = streamKey.replace(/^\/+|\/+$/g, '');
  const dir = path.join(root, 'dvr', app);

  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    logger.warn({ dir }, 'SRS DVR directory not readable');
    return null;
  }

  const prefix = `${stream}.`;
  const candidates = entries.filter((name) => name.startsWith(prefix) && name.endsWith('.flv'));
  if (candidates.length === 0) return null;

  let best: { name: string; mtime: number } | null = null;
  for (const name of candidates) {
    const full = path.join(dir, name);
    const stat = await fs.stat(full);
    if (notBeforeMs && stat.mtimeMs < notBeforeMs - 5000) continue;
    if (!best || stat.mtimeMs > best.mtime) {
      best = { name, mtime: stat.mtimeMs };
    }
  }

  return best ? path.join(dir, best.name) : null;
}

export function findSrsDvrFile(
  gatewayApp: string,
  streamKey: string,
  notBeforeMs?: number
): Promise<string | null> {
  return findSrsDvrFileInRoot(srsDvrRoot(), gatewayApp, streamKey, notBeforeMs);
}

async function uploadHlsPack(
  storage: ObjectStorageService,
  storageLocation: string,
  objectPrefix: string,
  localDir: string
): Promise<void> {
  const files = await fs.readdir(localDir);
  for (const name of files) {
    const localPath = path.join(localDir, name);
    const stat = await fs.stat(localPath);
    if (!stat.isFile()) continue;
    const contentType = name.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : 'video/mp2t';
    await storage.uploadFile(storageLocation, `${objectPrefix}/${name}`, localPath, {
      'Content-Type': contentType,
    });
  }
}

export async function processFinalizeRecording(
  job: Job<FinalizeRecordingJob>,
  repos: Repositories,
  storage = new ObjectStorageService(),
  enqueueAudioAsset?: (job: GenerateAudioAssetJob) => Promise<void>
): Promise<{ success: boolean; data?: unknown }> {
  const { recordingAssetId, organizationId, gatewayApp, streamKey } = job.data;
  logger.info({ jobId: job.id, recordingAssetId }, 'Finalizing recording upload');

  const recording = await repos.recordingAssets.findById(organizationId, recordingAssetId);
  if (!recording) {
    throw new Error(`Recording asset ${recordingAssetId} not found`);
  }

  if (recording.status === 'ready' && recording.fileSize > 0) {
    logger.info({ recordingAssetId }, 'Recording already finalized (idempotent skip)');
    return { success: true, data: { skipped: true } };
  }

  const startedAtMs = recording.startedAt
    ? new Date(String(recording.startedAt)).getTime()
    : undefined;
  const localPath = await findSrsDvrFile(gatewayApp, streamKey, startedAtMs);

  if (!localPath) {
    await repos.recordingAssets.markFailed(organizationId, recordingAssetId);
    throw new Error(
      `SRS DVR file not found for ${gatewayApp}/${streamKey} under ${srsDvrRoot()}/dvr`
    );
  }

  const stat = await fs.stat(localPath);
  const sourceFlvObjectKey = String(recording.objectKey);
  const policy = await repos.recordingPolicies.findById(
    organizationId,
    String(recording.recordingPolicyId)
  );
  const remuxToMp4 = Boolean(policy?.remuxToMp4);
  const keepSourceFlvHours =
    typeof policy?.keepSourceFlvHours === 'number' ? policy.keepSourceFlvHours : undefined;

  let primaryObjectKey = sourceFlvObjectKey;
  let primaryFileSize = stat.size;
  let primaryTarget: { bucket: string; objectKey: string } | null = null;
  let metadata: Record<string, unknown> | undefined;

  if (remuxToMp4) {
    let remuxed: Awaited<ReturnType<typeof remuxFlvToMp4>> | null = null;
    try {
      remuxed = await remuxFlvToMp4(localPath);
      const mp4Stat = await fs.stat(remuxed.file);
      primaryObjectKey = mp4ObjectKeyFromFlvKey(sourceFlvObjectKey);
      primaryFileSize = mp4Stat.size;
      primaryTarget = await storage.uploadFile(
        String(recording.storageLocation),
        primaryObjectKey,
        remuxed.file,
        {
          'Content-Type': 'video/mp4',
          'x-amz-meta-source': 'srs-dvr-remux',
        }
      );
      metadata = {
        ...(metadata ?? {}),
        sourceFlvObjectKey,
        remuxedFrom: 'flv',
        finalizedContainer: 'mp4',
      };
      logger.info({ recordingAssetId, objectKey: primaryObjectKey }, 'Recording remuxed to MP4');
    } catch (err) {
      logger.warn({ err, recordingAssetId }, 'MP4 remux failed — keeping FLV as primary recording');
      metadata = {
        ...(metadata ?? {}),
        finalizedContainer: 'flv',
        mp4RemuxFailed: true,
        mp4RemuxError: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (remuxed) await remuxed.cleanup();
    }
  }

  if (!primaryTarget) {
    primaryTarget = await storage.uploadFile(
      String(recording.storageLocation),
      primaryObjectKey,
      localPath,
      {
        'Content-Type': 'video/x-flv',
        'x-amz-meta-source': 'srs-dvr',
      }
    );
    metadata = {
      ...(metadata ?? {}),
      finalizedContainer: 'flv',
    };
  }

  if (remuxToMp4 && primaryObjectKey !== sourceFlvObjectKey && keepSourceFlvHours) {
    await storage.uploadFile(String(recording.storageLocation), sourceFlvObjectKey, localPath, {
      'Content-Type': 'video/x-flv',
      'x-amz-meta-source': 'srs-dvr-source',
    });
    metadata = {
      ...(metadata ?? {}),
      sourceFlvObjectKey,
      sourceFlvRetainUntil: retainUntil(keepSourceFlvHours),
    };
  }

  if (TRANSCODE_HLS) {
    let transcodeDir: string | null = null;
    try {
      const { dir } = await transcodeFlvToHls(localPath);
      transcodeDir = dir;
      const hlsCatalogPrefix = hlsObjectPrefixFromFlvKey(sourceFlvObjectKey);
      await uploadHlsPack(storage, String(recording.storageLocation), hlsCatalogPrefix, dir);
      metadata = { ...(metadata ?? {}), hlsManifestKey: `${hlsCatalogPrefix}/index.m3u8` };
      logger.info({ recordingAssetId, hlsManifestKey: metadata.hlsManifestKey }, 'HLS transcode uploaded');
    } catch (err) {
      logger.warn({ err, recordingAssetId }, 'HLS transcode failed — FLV playback still available');
    } finally {
      if (transcodeDir) await cleanupTranscodeDir(transcodeDir);
    }
  }

  const finalized = await repos.recordingAssets.completeFinalize(organizationId, recordingAssetId, {
    fileSize: primaryFileSize,
    status: 'ready',
    objectKey: primaryObjectKey,
    metadata,
  });

  logger.info(
    {
      recordingAssetId,
      bucket: primaryTarget.bucket,
      objectKey: primaryTarget.objectKey,
      bytes: primaryFileSize,
      localPath,
    },
    'Recording uploaded to storage'
  );

  if (enqueueAudioAsset) {
    await schedulePostRecordingAudio(repos, job.data, finalized!, stat.size, enqueueAudioAsset);
  }

  return { success: true, data: { recording: finalized } };
}

async function schedulePostRecordingAudio(
  repos: Repositories,
  job: FinalizeRecordingJob,
  recording: { id: unknown; liveSessionId: unknown; objectKey: unknown; duration: unknown },
  fileSize: number,
  enqueueAudioAsset: (job: GenerateAudioAssetJob) => Promise<void>
): Promise<void> {
  if (fileSize <= 0) return;

  const session = await repos.liveSessions.findById(job.organizationId, String(recording.liveSessionId));
  if (!session) return;

  const input = await repos.inputs.findById(job.organizationId, String(session.inputId));
  if (!input?.audioFeedProfileId && (!input?.audioFeedProfileIds || input.audioFeedProfileIds.length === 0)) return;

  await scheduleAudioDerivatives({
    repos,
    organizationId: job.organizationId,
    input: {
      id: String(input.id),
      name: String(input.name),
      organizationId: String(input.organizationId),
      streamKey: String(input.streamKey),
      audioFeedProfileId: input.audioFeedProfileId ? String(input.audioFeedProfileId) : undefined,
      audioFeedProfileIds: Array.isArray(input.audioFeedProfileIds)
        ? input.audioFeedProfileIds.map(String)
        : undefined,
    },
    session: {
      id: String(session.id),
      startedAt:
        session.startedAt instanceof Date
          ? session.startedAt
          : new Date(String(session.startedAt)),
    },
    trigger: 'post-recording',
    gatewayApp: job.gatewayApp,
    streamKey: job.streamKey,
    recordingAssetId: String(recording.id),
    recordingObjectKey: String(recording.objectKey),
    durationSec: Number(recording.duration) || undefined,
    sessionStartedAtMs: session.startedAt
      ? new Date(String(session.startedAt)).getTime()
      : undefined,
    enqueue: enqueueAudioAsset,
  });
}
