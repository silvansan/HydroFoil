import {
  enqueueFinalizeRecording,
  JobType,
  QueueManager,
  type FinalizeRecordingJob,
} from '@hydrofoil/queue';
import type { Queue } from '@hydrofoil/queue';
import pino from 'pino';

const logger = pino({ name: 'recording-orchestrator' });

export interface RecordingFinalizeTarget {
  id: string;
  organizationId: string;
  liveSessionId: string;
  objectKey: string;
  startedAt?: string | Date;
}

export function toFinalizeTarget(recording: {
  id: unknown;
  organizationId: unknown;
  liveSessionId: unknown;
  objectKey: unknown;
  startedAt?: unknown;
}): RecordingFinalizeTarget {
  return {
    id: String(recording.id),
    organizationId: String(recording.organizationId),
    liveSessionId: String(recording.liveSessionId),
    objectKey: String(recording.objectKey),
    startedAt:
      recording.startedAt instanceof Date
        ? recording.startedAt
        : recording.startedAt
          ? String(recording.startedAt)
          : undefined,
  };
}

export function recordingDurationSec(startedAt?: string | Date): number {
  const startedMs = startedAt ? new Date(startedAt).getTime() : Date.now();
  return Math.max(1, Math.floor((Date.now() - startedMs) / 1000));
}

export class RecordingOrchestrator {
  private readonly finalizeQueue: Queue<FinalizeRecordingJob>;

  constructor(queueManager: QueueManager) {
    this.finalizeQueue = queueManager.createQueue(JobType.FINALIZE_RECORDING);
  }

  async scheduleFinalize(
    recording: RecordingFinalizeTarget,
    session: { gatewayApp: string; streamKey: string },
    durationSec: number,
    repos: {
      recordingAssets: {
        findById: (orgId: string, id: string) => Promise<{ status: unknown } | null>;
        beginFinalize: (
          orgId: string,
          id: string,
          params: { duration: number }
        ) => Promise<unknown>;
      };
    }
  ): Promise<void> {
    const current = await repos.recordingAssets.findById(recording.organizationId, recording.id);
    if (!current) {
      logger.warn({ recordingId: recording.id }, 'Recording missing during finalize scheduling');
      return;
    }

    const currentStatus = String(current.status);

    if (currentStatus === 'ready') {
      logger.info({ recordingId: recording.id }, 'Recording already finalized, skipping enqueue');
      return;
    }

    if (currentStatus === 'recording' || currentStatus === 'failed') {
      await repos.recordingAssets.beginFinalize(recording.organizationId, recording.id, {
        duration: durationSec,
      });
    }

    await enqueueFinalizeRecording(this.finalizeQueue, {
      recordingAssetId: recording.id,
      organizationId: recording.organizationId,
      liveSessionId: recording.liveSessionId,
      objectKey: recording.objectKey,
      gatewayApp: session.gatewayApp,
      streamKey: session.streamKey,
    });

    logger.info(
      { recordingId: recording.id, gatewayApp: session.gatewayApp, streamKey: session.streamKey },
      'Recording finalize job enqueued'
    );
  }
}
