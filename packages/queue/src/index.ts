// Job queue abstraction for HydroFoil

import Queue from 'bull';

export type { Queue } from 'bull';

export interface JobData {
  [key: string]: unknown;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class QueueManager {
  private queues: Map<string, Queue.Queue> = new Map();
  private readonly redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  createQueue<T extends JobData>(queueName: string): Queue.Queue<T> {
    if (!this.queues.has(queueName)) {
      const queue = new Queue<T>(queueName, this.redisUrl);
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName) as Queue.Queue<T>;
  }

  getQueue<T extends JobData>(queueName: string): Queue.Queue<T> | undefined {
    return this.queues.get(queueName) as Queue.Queue<T> | undefined;
  }

  async closeAll(): Promise<void> {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}

export enum JobType {
  FINALIZE_RECORDING = 'finalize-recording',
  GENERATE_AUDIO_ASSET = 'generate-audio-asset',
  RECONCILE_GATEWAY_CONFIG = 'reconcile-gateway-config',
  EXTRACT_METADATA = 'extract-metadata',
  MOVE_MEDIA = 'move-media',
  DELETE_ASSET = 'delete-asset',
  START_RESTREAM_PUSH = 'start-restream-push',
  STOP_RESTREAM_PUSH = 'stop-restream-push',
}

export interface FinalizeRecordingJob extends JobData {
  recordingAssetId: string;
  liveSessionId: string;
  objectKey: string;
  organizationId: string;
  gatewayApp: string;
  streamKey: string;
}

export interface GenerateAudioAssetJob extends JobData {
  audioAssetId: string;
  audioFeedProfileId: string;
  organizationId: string;
  codec: string;
  container: string;
  objectKey: string;
  storageLocation: string;
  trigger: 'live' | 'post-recording';
  liveSessionId: string;
  recordingAssetId?: string;
  gatewayApp?: string;
  streamKey?: string;
  recordingObjectKey?: string;
  durationSec?: number;
  sessionStartedAtMs?: number;
}

export interface ReconcileGatewayConfigJob extends JobData {
  organizationId: string;
  reason: string;
  triggerAggregateId?: string;
}

/** @deprecated Use ReconcileGatewayConfigJob */
export type ReconcileOMEConfigJob = ReconcileGatewayConfigJob;

export interface ExtractMetadataJob extends JobData {
  recordingAssetId: string;
  objectKey: string;
  organizationId: string;
}

export interface RestreamPushDestination {
  destinationId: string;
  pushUrl: string;
  name: string;
}

export interface StartRestreamPushJob extends JobData {
  sessionId: string;
  inputId: string;
  organizationId: string;
  gatewayApp: string;
  streamKey: string;
  sourceUrl: string;
  destinations: RestreamPushDestination[];
}

export interface StopRestreamPushJob extends JobData {
  sessionId: string;
}

/** Idempotent enqueue — one pending reconcile job per organization */
export async function enqueueGatewayReconciliation(
  queue: Queue.Queue<ReconcileGatewayConfigJob>,
  job: ReconcileGatewayConfigJob
): Promise<void> {
  await queue.add(job, {
    jobId: `reconcile-gateway-${job.organizationId}`,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

/** Enqueue DVR finalize — one job per recording asset (idempotent jobId). */
export async function enqueueFinalizeRecording(
  queue: Queue.Queue<FinalizeRecordingJob>,
  job: FinalizeRecordingJob
): Promise<void> {
  await queue.add(job, {
    jobId: `finalize-recording-${job.recordingAssetId}`,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
  });
}

/** Start FFmpeg SRT push for all destinations on a live session (idempotent per session). */
export async function enqueueStartRestreamPush(
  queue: Queue.Queue<StartRestreamPushJob>,
  job: StartRestreamPushJob
): Promise<void> {
  await queue.add(job, {
    jobId: `start-restream-${job.sessionId}`,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}

/** Enqueue audio derivative generation — one job per asset (idempotent jobId). */
export async function enqueueGenerateAudioAsset(
  queue: Queue.Queue<GenerateAudioAssetJob>,
  job: GenerateAudioAssetJob
): Promise<void> {
  await queue.add(job, {
    jobId: `generate-audio-${job.audioAssetId}`,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    delay: job.trigger === 'live' ? 8_000 : undefined,
  });
}

/** Stop FFmpeg SRT push processes for a session. */
export async function enqueueStopRestreamPush(
  queue: Queue.Queue<StopRestreamPushJob>,
  job: StopRestreamPushJob
): Promise<void> {
  await queue.add(job, {
    jobId: `stop-restream-${job.sessionId}`,
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  });
}
