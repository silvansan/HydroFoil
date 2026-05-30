import axios from 'axios';
import pino from 'pino';
import { streamStarted, streamStopped } from '@hydrofoil/events';

import type { AppContext } from '../context';
import { config } from '../config';
import {
  recordingDurationSec,
  toFinalizeTarget,
} from './recording-orchestrator';

const logger = pino({ name: 'live-session-sync' });

interface SrsStreamRow {
  name: string;
  app?: string;
  publish?: { active?: boolean };
}

/** Reconcile DB live sessions with SRS active publishers (hooks may not fire in all vhost setups). */
export async function syncLiveSessionsFromSrs(
  ctx: Pick<AppContext, 'repos' | 'organizationId' | 'gateway' | 'recordings'>
): Promise<void> {
  try {
    const response = await axios.get(`${config.srsHttpApiUrl}/api/v1/streams/`, {
      timeout: 5000,
    });
    const streams: SrsStreamRow[] = response.data?.streams ?? [];
    const activeStreams = streams.filter((row) => row.publish?.active !== false);

    for (const row of activeStreams) {
      const streamKey = row.name;
      const gatewayApp = (row.app ?? 'live').replace(/^\/+|\/+$/g, '');
      const input = await ctx.repos.inputs.findByAppAndStreamKey(
        ctx.organizationId,
        gatewayApp,
        streamKey
      );
      if (!input?.enabled) continue;

      const existing = await ctx.repos.liveSessions.findActiveByAppAndStreamKey(
        ctx.organizationId,
        gatewayApp,
        streamKey
      );
      if (existing) continue;

      const session = await ctx.repos.liveSessions.create({
        inputId: input.id,
        organizationId: ctx.organizationId,
        gatewayApp,
        streamKey,
        status: 'publishing',
      });
      await ctx.gateway.publish(
        streamStarted(session.id, ctx.organizationId, input.id, streamKey)
      );
      logger.info({ streamKey, sessionId: session.id }, 'LiveSession synced from SRS');
    }

    const publishing = await ctx.repos.liveSessions.listPublishing(ctx.organizationId);
    const activeSet = new Set(
      activeStreams.map((row) => `${(row.app ?? 'live').replace(/^\/+|\/+$/g, '')}/${row.name}`)
    );
    for (const session of publishing) {
      const key = `${session.gatewayApp ?? 'live'}/${session.streamKey}`;
      if (activeSet.has(key)) continue;

      const activeRecording = await ctx.repos.recordingAssets.findActiveBySessionId(
        ctx.organizationId,
        session.id
      );
      if (activeRecording) {
        const target = toFinalizeTarget(activeRecording);
        const durationSec = recordingDurationSec(target.startedAt);
        await ctx.recordings.scheduleFinalize(
          target,
          {
            gatewayApp: session.gatewayApp ?? 'live',
            streamKey: session.streamKey,
          },
          durationSec,
          ctx.repos
        );
        logger.info({ streamKey: session.streamKey }, 'Recording finalize enqueued (stream offline)');
      }

      const ended = await ctx.repos.liveSessions.endSession(session.id);
      if (ended) {
        await ctx.gateway.publish(
          streamStopped(ended.id, ctx.organizationId, String(ended.inputId), session.streamKey)
        );
        logger.info({ streamKey: session.streamKey }, 'LiveSession ended (not on SRS)');
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'SRS live session sync failed');
  }
}
