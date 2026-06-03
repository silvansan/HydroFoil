import { scheduleAudioDerivatives } from '@hydrofoil/db';
import {
  enqueueGenerateAudioAsset,
  JobType,
  QueueManager,
  type GenerateAudioAssetJob,
} from '@hydrofoil/queue';
import type { Queue } from '@hydrofoil/queue';
import type { Input, LiveSession } from '@hydrofoil/shared-types';
import pino from 'pino';

const logger = pino({ name: 'audio-orchestrator' });

export class AudioOrchestrator {
  private readonly audioQueue: Queue<GenerateAudioAssetJob>;

  constructor(queueManager: QueueManager) {
    this.audioQueue = queueManager.createQueue(JobType.GENERATE_AUDIO_ASSET);
  }

  async scheduleForSession(params: {
    organizationId: string;
    input: Pick<Input, 'id' | 'name' | 'organizationId' | 'streamKey' | 'audioFeedProfileId' | 'audioFeedProfileIds'>;
    session: Pick<LiveSession, 'id' | 'startedAt'>;
    trigger: 'live' | 'post-recording';
    gatewayApp: string;
    streamKey: string;
    recordingAssetId?: string;
    recordingObjectKey?: string;
    durationSec?: number;
    sessionStartedAtMs?: number;
    repos: Parameters<typeof scheduleAudioDerivatives>[0]['repos'];
  }): Promise<number> {
    const count = await scheduleAudioDerivatives({
      repos: params.repos,
      organizationId: params.organizationId,
      input: params.input,
      session: params.session,
      trigger: params.trigger,
      gatewayApp: params.gatewayApp,
      streamKey: params.streamKey,
      recordingAssetId: params.recordingAssetId,
      recordingObjectKey: params.recordingObjectKey,
      durationSec: params.durationSec,
      sessionStartedAtMs: params.sessionStartedAtMs,
      enqueue: (job) => enqueueGenerateAudioAsset(this.audioQueue, job),
    });

    if (count > 0) {
      logger.info(
        {
          sessionId: params.session.id,
          trigger: params.trigger,
          streamKey: params.streamKey,
          count,
        },
        'Audio derivative jobs enqueued'
      );
    }

    return count;
  }
}
