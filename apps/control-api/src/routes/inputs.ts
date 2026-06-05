import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { afterRoutingMutation } from '../lib/routing-mutations';
import { parsePagination } from '../lib/pagination';
import { formatZodError } from '../lib/zod-errors';
import {
  provisionDefaultInputPlayback,
  teardownInputPlayback,
} from '../lib/provision-input-playback';
import { buildInputPlaybackShare } from '../services/input-playback-share';
import {
  assertApplicationAccess,
  assertInputAccess,
  assertRecordingPolicyAttachAccess,
  getAccessScope,
} from '../lib/access-control';

const createInputSchema = z.object({
  applicationId: z.string().uuid(),
  name: z.string().min(1),
  streamKey: z.string().min(1),
  ingestProtocol: z.enum(['rtmp', 'rtsp', 'hls', 'http']),
  enabled: z.boolean().optional(),
  sourceRestrictions: z.array(z.string()).optional(),
  streamProfileId: z.union([z.string().uuid(), z.null()]).optional(),
  recordingPolicyId: z.union([z.string().uuid(), z.null()]).optional(),
  audioFeedProfileId: z.union([z.string().uuid(), z.null()]).optional(),
  streamProfileIds: z.array(z.string().uuid()).optional(),
  recordingPolicyIds: z.array(z.string().uuid()).optional(),
  audioFeedProfileIds: z.array(z.string().uuid()).optional(),
  /** Applies this privacy policy to all playback outputs on this stream key's routes. */
  domainBlockId: z.union([z.string().uuid(), z.null()]).optional(),
});

const updateInputSchema = createInputSchema.partial();

export function createInputsRouter(ctx: AppContext): Router {
  const router = Router();

  const validateIds = async (
    ids: string[] | undefined,
    exists: (id: string) => Promise<unknown>,
    message: string
  ) => {
    for (const id of ids ?? []) {
      if (!(await exists(id))) {
        throw new BadRequestError(message);
      }
    }
  };

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const pagination = parsePagination(req);
      const applicationId =
        typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
      if (applicationId) {
        assertApplicationAccess(scope, applicationId);
      }
      const result = await ctx.repos.inputs.list(ctx.organizationId, {
        ...pagination,
        applicationId,
        applicationIds: applicationId ? undefined : (scope.applicationIds ?? undefined),
      });
      res.json(result);
    })
  );

  router.get(
    '/:id/playback-url',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
      const share = await buildInputPlaybackShare(ctx, req.params.id, req);
      res.json(share);
    })
  );

  router.get(
    '/:id/sessions',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.id);
      if (!input) {
        throw new NotFoundError('Input not found');
      }
      res.json(
        await ctx.repos.liveSessions.listByInputId(
          ctx.organizationId,
          input.id,
          parsePagination(req)
        )
      );
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.id);
      if (!input) {
        throw new NotFoundError('Input not found');
      }
      res.json(input);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const parsed = createInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      const recordingPolicyIds =
        parsed.data.recordingPolicyIds ??
        (parsed.data.recordingPolicyId ? [parsed.data.recordingPolicyId] : []);
      const streamProfileIds =
        parsed.data.streamProfileIds ??
        (parsed.data.streamProfileId ? [parsed.data.streamProfileId] : []);
      const audioFeedProfileIds =
        parsed.data.audioFeedProfileIds ??
        (parsed.data.audioFeedProfileId ? [parsed.data.audioFeedProfileId] : []);

      await validateIds(
        recordingPolicyIds,
        (id) => ctx.repos.recordingPolicies.findById(ctx.organizationId, id),
        'Recording policy not found'
      );
      await validateIds(
        streamProfileIds,
        (id) => ctx.repos.streamProfiles.findById(ctx.organizationId, id),
        'Stream profile not found'
      );
      await validateIds(
        audioFeedProfileIds,
        (id) => ctx.repos.audioFeedProfiles.findById(ctx.organizationId, id),
        'Audio feed profile not found'
      );
      assertApplicationAccess(scope, parsed.data.applicationId);
      for (const policyId of recordingPolicyIds) {
        assertRecordingPolicyAttachAccess(scope, policyId);
      }
      const application = await ctx.repos.applications.findById(
        ctx.organizationId,
        parsed.data.applicationId
      );
      if (!application) {
        throw new BadRequestError('Application not found');
      }
      const input = await ctx.repos.inputs.create(ctx.organizationId, {
        applicationId: parsed.data.applicationId,
        name: parsed.data.name,
        streamKey: parsed.data.streamKey,
        ingestProtocol: parsed.data.ingestProtocol,
        enabled: parsed.data.enabled,
        sourceRestrictions: parsed.data.sourceRestrictions,
        streamProfileIds,
        recordingPolicyIds,
        audioFeedProfileIds,
      });
      if (!input) {
        throw new BadRequestError('Failed to create input');
      }
      const playback = await provisionDefaultInputPlayback(
        ctx,
        input as import('@hydrofoil/shared-types').Input,
        application as import('@hydrofoil/shared-types').Application
      );
      await afterRoutingMutation(ctx.gateway, 'input.created', input.id);
      res.status(201).json({ ...input, primaryOutputId: playback.outputId, primaryRouteId: playback.routeId });
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      await assertInputAccess(ctx.organizationId, req.params.id, scope, ctx.repos);
      const parsed = updateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      const recordingPolicyIds =
        parsed.data.recordingPolicyIds ??
        (parsed.data.recordingPolicyId ? [parsed.data.recordingPolicyId] : undefined);
      const streamProfileIds =
        parsed.data.streamProfileIds ??
        (parsed.data.streamProfileId ? [parsed.data.streamProfileId] : undefined);
      const audioFeedProfileIds =
        parsed.data.audioFeedProfileIds ??
        (parsed.data.audioFeedProfileId ? [parsed.data.audioFeedProfileId] : undefined);

      await validateIds(
        recordingPolicyIds,
        (id) => ctx.repos.recordingPolicies.findById(ctx.organizationId, id),
        'Recording policy not found'
      );
      await validateIds(
        streamProfileIds,
        (id) => ctx.repos.streamProfiles.findById(ctx.organizationId, id),
        'Stream profile not found'
      );
      await validateIds(
        audioFeedProfileIds,
        (id) => ctx.repos.audioFeedProfiles.findById(ctx.organizationId, id),
        'Audio feed profile not found'
      );
      if (parsed.data.applicationId) {
        assertApplicationAccess(scope, parsed.data.applicationId);
      }
      for (const policyId of recordingPolicyIds ?? []) {
        assertRecordingPolicyAttachAccess(scope, policyId);
      }
      const updateData = {
        ...parsed.data,
        ...(recordingPolicyIds !== undefined ? { recordingPolicyIds } : {}),
        ...(streamProfileIds !== undefined ? { streamProfileIds } : {}),
        ...(audioFeedProfileIds !== undefined ? { audioFeedProfileIds } : {}),
      };
      const input = await ctx.repos.inputs.update(ctx.organizationId, req.params.id, updateData);
      if (!input) {
        throw new NotFoundError('Input not found');
      }

      if (parsed.data.domainBlockId !== undefined) {
        const routes = await ctx.repos.routes.findByInputId(
          ctx.organizationId,
          String(input.id)
        );
        const outputIds = [
          ...new Set(routes.flatMap((route: { outputIds: string[] }) => route.outputIds.map(String))),
        ];
        const policyId =
          parsed.data.domainBlockId === null ? undefined : parsed.data.domainBlockId;
        if (policyId) {
          const block = await ctx.repos.domainBlocks.findById(ctx.organizationId, policyId);
          if (!block) {
            throw new BadRequestError('Privacy policy not found');
          }
        }
        for (const outputId of outputIds) {
          await ctx.repos.outputs.update(ctx.organizationId, String(outputId), {
            domainBlockId: policyId,
          });
        }
      }

      await afterRoutingMutation(ctx.gateway, 'input.updated', input.id);
      res.json(input);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.id, getAccessScope(req), ctx.repos);
      const inputId = req.params.id;
      await teardownInputPlayback(ctx, inputId);
      const deleted = await ctx.repos.inputs.delete(ctx.organizationId, inputId);
      if (!deleted) {
        throw new NotFoundError('Input not found');
      }
      await afterRoutingMutation(ctx.gateway, 'input.deleted', inputId);
      res.status(204).send();
    })
  );

  return router;
}
