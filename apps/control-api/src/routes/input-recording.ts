import { Router } from 'express';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import {
  buildRecordingObjectKey,
  buildStorageLocationRef,
  getRecordingPoliciesForInput,
  joinStoragePrefix,
} from '../lib/recording-defaults';
import {
  recordingDurationSec,
  toFinalizeTarget,
} from '../services/recording-orchestrator';
import { startSrsDvr, stopSrsDvr } from '../services/srs-dvr';
import { assertInputAccess, getAccessScope } from '../lib/access-control';

export function createInputRecordingRouter(ctx: AppContext): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/start',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
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

      const existing = await ctx.repos.recordingAssets.listActiveBySessionId(
        ctx.organizationId,
        session.id
      );
      if (existing.length > 0) {
        res.json({ recordings: existing, recording: existing[0], alreadyRecording: true });
        return;
      }

      const policies = await getRecordingPoliciesForInput(ctx, input);
      if (policies.length === 0) {
        throw new BadRequestError(
          'No recording policies configured. Assign policies on this stream key or create one under Recording Policies.'
        );
      }

      const dvr = await startSrsDvr({ gatewayApp: appName, streamKey: input.streamKey });
      if (!dvr.ok) {
        throw new BadRequestError(
          'Could not start SRS DVR. Check that SRS is running and the stream is publishing.'
        );
      }

      const recordings = [];
      for (const policy of policies) {
        const objectKey = joinStoragePrefix(
          policy.storage_prefix,
          buildRecordingObjectKey(appName, input.streamKey, session.id, policy)
        );
        const storageLocation = buildStorageLocationRef(
          ctx.organizationId,
          String(policy.storage_location_id)
        );

        recordings.push(
          await ctx.repos.recordingAssets.create({
            organizationId: ctx.organizationId,
            liveSessionId: session.id,
            recordingPolicyId: policy.id,
            storageLocation,
            objectKey,
          })
        );
      }

      await ctx.repos.liveSessions.updateStatus(session.id, 'recording');

      res.status(201).json({ recordings, recording: recordings[0], alreadyRecording: false });
    })
  );

  router.post(
    '/stop',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
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

      const activeRecordings = await ctx.repos.recordingAssets.listActiveBySessionId(
        ctx.organizationId,
        session.id
      );
      if (activeRecordings.length === 0) {
        throw new BadRequestError('No active recording for this stream.');
      }

      await stopSrsDvr({ gatewayApp: appName, streamKey: input.streamKey });

      for (const active of activeRecordings) {
        const durationSec = recordingDurationSec(toFinalizeTarget(active).startedAt);
        await ctx.recordings.scheduleFinalize(
          toFinalizeTarget(active),
          { gatewayApp: appName, streamKey: input.streamKey },
          durationSec,
          ctx.repos
        );
      }

      const finalized = await Promise.all(
        activeRecordings.map((active: { id: unknown }) =>
          ctx.repos.recordingAssets.findById(ctx.organizationId, String(active.id))
        )
      );

      res.json({ recordings: finalized.filter(Boolean), recording: finalized.find(Boolean) });
    })
  );

  return router;
}
