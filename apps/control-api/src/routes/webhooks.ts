import { Router } from 'express';
import { z } from 'zod';
import pino from 'pino';
import { streamStarted, streamStopped } from '@hydrofoil/events';
import {
  buildForwardRtmpUrls,
  findIngestByAppAndStreamKey,
} from '@hydrofoil/domain';
import { GatewayReconciliationService } from '@hydrofoil/db';
import type { AppContext } from '../context';
import { BadRequestError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { config } from '../config';
import { verifySrsWebhookSecret } from '../lib/srs-webhook-auth';
import {
  recordingDurationSec,
  toFinalizeTarget,
} from '../services/recording-orchestrator';

const logger = pino({ name: 'srs-webhooks' });

const srsWebhookSchema = z.object({
  action: z.string(),
  stream: z.string(),
  app: z.string().optional(),
  vhost: z.string().optional(),
  client_id: z.string().optional(),
  stream_id: z.string().optional(),
});

const srsForwardHookSchema = z.object({
  action: z.string().optional(),
  stream: z.string(),
  app: z.string().optional(),
  vhost: z.string().optional(),
  param: z.string().optional(),
});

/** SRS requires HTTP 200 and body `{"code":0}` (or raw `0`) for hooks to succeed. */
function srsOk(res: { status: (code: number) => { json: (body: unknown) => void } }, data?: Record<string, unknown>) {
  res.status(200).json({ code: 0, ...(data ? { data } : {}) });
}

export function createWebhooksRouter(ctx: AppContext): Router {
  const router = Router();
  const gatewayReconciliation = new GatewayReconciliationService(ctx.repos);

  router.post(
    '/srs',
    asyncHandler(async (req, res) => {
      if (!verifySrsWebhookSecret(req, res)) return;

      const parsed = srsWebhookSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.message);
      }

      const { action, stream: streamKey, app: hookApp } = parsed.data;
      const gatewayApp = (hookApp ?? 'live').replace(/^\/+|\/+$/g, '');
      logger.info({ action, streamKey, gatewayApp }, 'SRS http hook');

      const input = await ctx.repos.inputs.findByAppAndStreamKey(
        ctx.organizationId,
        gatewayApp,
        streamKey
      );

      if (!input) {
        logger.warn({ streamKey }, 'Publish for unknown stream key — allow publish, no LiveSession');
        srsOk(res, { note: `No input registered for stream key: ${streamKey}` });
        return;
      }

      if (action === 'on_publish') {
        const existing = await ctx.repos.liveSessions.findActiveByAppAndStreamKey(
          ctx.organizationId,
          gatewayApp,
          streamKey
        );
        if (existing) {
          srsOk(res, { sessionId: existing.id, duplicate: true });
          return;
        }

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

        await ctx.restreams.startSrtPushes({
          sessionId: session.id,
          inputId: input.id,
          organizationId: ctx.organizationId,
          gatewayApp,
          streamKey,
          repos: ctx.repos,
        });

        logger.info({ sessionId: session.id, streamKey }, 'LiveSession created');
        srsOk(res, { sessionId: session.id });
        return;
      }

      if (action === 'on_unpublish') {
        const active = await ctx.repos.liveSessions.findActiveByAppAndStreamKey(
          ctx.organizationId,
          gatewayApp,
          streamKey
        );
        if (!active) {
          srsOk(res, { note: 'No active session' });
          return;
        }

        const sessionStartedAt =
          active.startedAt instanceof Date
            ? active.startedAt
            : new Date(String(active.startedAt));
        const durationSec = recordingDurationSec(sessionStartedAt);
        const sessionStartedAtMs = sessionStartedAt.getTime();

        const activeRecordings = await ctx.repos.recordingAssets.listActiveBySessionId(
          ctx.organizationId,
          active.id
        );

        // When a recording will finalize, audio is extracted from the uploaded recording (higher quality, no DVR race).
        if (activeRecordings.length === 0) {
          await ctx.audio.scheduleForSession({
            organizationId: ctx.organizationId,
            input: {
              id: String(input.id),
              name: String(input.name),
              organizationId: String(input.organizationId),
              streamKey: String(input.streamKey),
              audioFeedProfileId: input.audioFeedProfileId
                ? String(input.audioFeedProfileId)
                : undefined,
              audioFeedProfileIds: Array.isArray(input.audioFeedProfileIds)
                ? input.audioFeedProfileIds.map(String)
                : undefined,
            },
            session: {
              id: String(active.id),
              startedAt: sessionStartedAt,
            },
            trigger: 'live',
            gatewayApp,
            streamKey,
            durationSec,
            sessionStartedAtMs,
            repos: ctx.repos,
          });
        }
        for (const activeRecording of activeRecordings) {
          const target = toFinalizeTarget(activeRecording);
          const durationSec = recordingDurationSec(target.startedAt);
          await ctx.recordings.scheduleFinalize(
            target,
            { gatewayApp, streamKey },
            durationSec,
            ctx.repos
          );
          logger.info(
            { recordingId: activeRecording.id, streamKey, durationSec },
            'Recording finalize enqueued on unpublish'
          );
        }

        const ended = await ctx.repos.liveSessions.endSession(active.id);
        if (ended) {
          await ctx.gateway.publish(
            streamStopped(ended.id, ctx.organizationId, input.id, streamKey)
          );
        }

        await ctx.restreams.stopSrtPushes(active.id);

        logger.info({ sessionId: active.id, streamKey }, 'LiveSession ended');
        srsOk(res, { sessionId: active.id });
        return;
      }

      srsOk(res, { note: `Unhandled action: ${action}` });
    })
  );

  /**
   * SRS dynamic forward hook — returns RTMP destinations for an active publish.
   * @see https://ossrs.net/lts/en-us/docs/v5/doc/forward
   */
  router.post(
    '/srs/forward',
    asyncHandler(async (req, res) => {
      if (!verifySrsWebhookSecret(req, res)) return;

      const parsed = srsForwardHookSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.message);
      }

      const streamKey = parsed.data.stream;
      const gatewayApp = (parsed.data.app ?? 'live').replace(/^\/+|\/+$/g, '');
      logger.info({ streamKey, gatewayApp, action: parsed.data.action }, 'SRS forward hook');

      const desired = await gatewayReconciliation.buildDesiredConfig(ctx.organizationId);
      const ingest = findIngestByAppAndStreamKey(desired, gatewayApp, streamKey);

      if (!ingest || ingest.forwards.length === 0) {
        res.json({ code: 0, data: { urls: [] } });
        return;
      }

      const urls = buildForwardRtmpUrls(ingest.forwards, config.srsRtmpForwardBase, {
        app: gatewayApp,
        stream: streamKey,
      });
      logger.info({ streamKey, urlCount: urls.length }, 'SRS forward URLs');
      res.json({ code: 0, data: { urls } });
    })
  );

  return router;
}
