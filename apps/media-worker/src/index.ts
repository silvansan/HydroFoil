// HydroFoil Media Worker

import pino from 'pino';
import { createRepositories, Database } from '@hydrofoil/db';
import {
  enqueueGenerateAudioAsset,
  JobType,
  QueueManager,
  type FinalizeRecordingJob,
  type GenerateAudioAssetJob,
  type ReconcileGatewayConfigJob,
  type StartRestreamPushJob,
  type StopRestreamPushJob,
} from '@hydrofoil/queue';
import type { Job } from 'bull';

import { processFinalizeRecording } from './handlers/finalize-recording';
import { processGenerateAudioAsset } from './handlers/generate-audio-asset';
import { processReconcileGatewayConfig } from './handlers/reconcile-gateway';
import { processStartRestreamPush, processStopRestreamPush, stopAllRestreamPushes } from './handlers/restream-push';
import { startSourceFlvCleanupLoop } from './handlers/source-flv-cleanup';
import { createObjectStorageService } from './services/object-storage';

const logger = pino();

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://hydrofoil:hydrofoil_dev@localhost:5432/hydrofoil';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const sourceFlvCleanupIntervalMs = Number(
  process.env.SOURCE_FLV_CLEANUP_INTERVAL_MS ?? 60 * 60 * 1000
);

async function main() {
  const db = new Database({ connectionString: databaseUrl });
  await db.connect();
  const repos = createRepositories(db);

  const queueManager = new QueueManager(redisUrl);
  const objectStorage = createObjectStorageService(repos);
  startSourceFlvCleanupLoop(repos, objectStorage, sourceFlvCleanupIntervalMs);

  const recordingQueue = queueManager.createQueue<FinalizeRecordingJob>(JobType.FINALIZE_RECORDING);
  const audioQueue = queueManager.createQueue<GenerateAudioAssetJob>(JobType.GENERATE_AUDIO_ASSET);
  const configQueue = queueManager.createQueue<ReconcileGatewayConfigJob>(
    JobType.RECONCILE_GATEWAY_CONFIG
  );
  const restreamStartQueue = queueManager.createQueue<StartRestreamPushJob>(
    JobType.START_RESTREAM_PUSH
  );
  const restreamStopQueue = queueManager.createQueue<StopRestreamPushJob>(
    JobType.STOP_RESTREAM_PUSH
  );

  recordingQueue.process(async (job) => {
    return processFinalizeRecording(job, repos, objectStorage, (audioJob) =>
      enqueueGenerateAudioAsset(audioQueue, audioJob)
    );
  });

  audioQueue.process(async (job) => {
    return processGenerateAudioAsset(job as Job<GenerateAudioAssetJob>, repos, objectStorage);
  });

  configQueue.process(async (job) => {
    return processReconcileGatewayConfig(job as Job<ReconcileGatewayConfigJob>, repos);
  });

  restreamStartQueue.process(async (job) => {
    return processStartRestreamPush(job as Job<StartRestreamPushJob>);
  });

  restreamStopQueue.process(async (job) => {
    return processStopRestreamPush(job as Job<StopRestreamPushJob>);
  });

  recordingQueue.on('failed', (job, err) => {
    logger.error({ jobId: job.id, error: err.message }, 'Recording job failed');
  });

  audioQueue.on('failed', (job, err) => {
    logger.error({ jobId: job.id, error: err.message }, 'Audio job failed');
  });

  configQueue.on('failed', (job, err) => {
    logger.error({ jobId: job.id, error: err.message }, 'Gateway config job failed');
  });

  restreamStartQueue.on('failed', (job, err) => {
    logger.error({ jobId: job.id, error: err.message }, 'Restream start job failed');
  });

  restreamStopQueue.on('failed', (job, err) => {
    logger.error({ jobId: job.id, error: err.message }, 'Restream stop job failed');
  });

  logger.info('Media worker initialized');
}

main().catch((error) => {
  logger.error(error, 'Media worker failed to start');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  stopAllRestreamPushes();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  stopAllRestreamPushes();
  process.exit(0);
});
