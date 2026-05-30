import { Router } from 'express';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import {
  buildRecordingObjectKey,
  buildStorageLocationRef,
  getRecordingPolicyForInput,
  joinStoragePrefix,
} from '../lib/recording-defaults';
import {
  recordingDurationSec,
  toFinalizeTarget,
} from '../services/recording-orchestrator';
import { startSrsDvr, stopSrsDvr } from '../services/srs-dvr';

export function createInputRecordingRouter(ctx: AppContext): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/start',
    asyncHandler(async (req, res) => {
      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.id);
      if (!input) throw new NotFoundError('Input not found');

      const appName = input.application?.appName ?? 'live';
      const session = await ctx.repos.liveSessions.findActiveByAppAndStreamKey(
        ctx.organizationId,
        appName,
        input.streamKey
      );
      if (!session) {
        throw new BadRequestError(
          'No active publish for this stream key. Start your encoder first.'
        );
      }

      const existing = await ctx.repos.recordingAssets.findActiveBySessionId(
        ctx.organizationId,
        session.id
      );
      if (existing) {
        res.json({ recording: existing, alreadyRecording: true });
        return;
      }

      const policy = await getRecordingPolicyForInput(ctx, input);
      if (!policy) {
        throw new BadRequestError(
          'No recording policy configured. Assign a policy on this stream key or create one under Recording Policies.'
        );
      }

      const dvr = await startSrsDvr({ gatewayApp: appName, streamKey: input.streamKey });
      if (!dvr.ok) {
        throw new BadRequestError(
          'Could not start SRS DVR. Check that SRS is running and the stream is publishing.'
        );
      }

      const objectKey = joinStoragePrefix(
        policy.storage_prefix,
        buildRecordingObjectKey(appName, input.streamKey, session.id, policy)
      );
      const storageLocation = buildStorageLocationRef(
        ctx.organizationId,
        String(policy.storage_location_id)
      );

      const recording = await ctx.repos.recordingAssets.create({
        organizationId: ctx.organizationId,
        liveSessionId: session.id,
        recordingPolicyId: policy.id,
        storageLocation,
        objectKey,
      });

      await ctx.repos.liveSessions.updateStatus(session.id, 'recording');

      res.status(201).json({ recording, alreadyRecording: false });
    })
  );

  router.post(
    '/stop',
    asyncHandler(async (req, res) => {
      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.id);
      if (!input) throw new NotFoundError('Input not found');

      const appName = input.application?.appName ?? 'live';
      const session = await ctx.repos.liveSessions.findActiveByAppAndStreamKey(
        ctx.organizationId,
        appName,
        input.streamKey
      );
      if (!session) {
        throw new BadRequestError('No active publish for this stream key.');
      }

      const active = await ctx.repos.recordingAssets.findActiveBySessionId(
        ctx.organizationId,
        session.id
      );
      if (!active) {
        throw new BadRequestError('No active recording for this stream.');
      }

      await stopSrsDvr({ gatewayApp: appName, streamKey: input.streamKey });

      const durationSec = recordingDurationSec(
        toFinalizeTarget(active).startedAt
      );

      await ctx.recordings.scheduleFinalize(
        toFinalizeTarget(active),
        { gatewayApp: appName, streamKey: input.streamKey },
        durationSec,
        ctx.repos
      );

      const finalized = await ctx.repos.recordingAssets.findById(ctx.organizationId, String(active.id));

      res.json({ recording: finalized });
    })
  );

  return router;
}
