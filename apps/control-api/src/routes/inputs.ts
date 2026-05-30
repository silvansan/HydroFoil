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
});

const updateInputSchema = createInputSchema.partial();

export function createInputsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const pagination = parsePagination(req);
      const applicationId =
        typeof req.query.applicationId === 'string' ? req.query.applicationId : undefined;
      const result = await ctx.repos.inputs.list(ctx.organizationId, {
        ...pagination,
        applicationId,
      });
      res.json(result);
    })
  );

  router.get(
    '/:id/sessions',
    asyncHandler(async (req, res) => {
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
      const parsed = createInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      if (parsed.data.recordingPolicyId) {
        const policy = await ctx.repos.recordingPolicies.findById(
          ctx.organizationId,
          parsed.data.recordingPolicyId
        );
        if (!policy) {
          throw new BadRequestError('Recording policy not found');
        }
      }
      if (parsed.data.streamProfileId) {
        const profile = await ctx.repos.streamProfiles.findById(
          ctx.organizationId,
          parsed.data.streamProfileId
        );
        if (!profile) {
          throw new BadRequestError('Stream profile not found');
        }
      }
      if (parsed.data.audioFeedProfileId) {
        const profile = await ctx.repos.audioFeedProfiles.findById(
          ctx.organizationId,
          parsed.data.audioFeedProfileId
        );
        if (!profile) {
          throw new BadRequestError('Audio feed profile not found');
        }
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
        streamProfileId: parsed.data.streamProfileId ?? undefined,
        recordingPolicyId: parsed.data.recordingPolicyId ?? undefined,
        audioFeedProfileId: parsed.data.audioFeedProfileId ?? undefined,
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
      const parsed = updateInputSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      if (parsed.data.recordingPolicyId) {
        const policy = await ctx.repos.recordingPolicies.findById(
          ctx.organizationId,
          parsed.data.recordingPolicyId
        );
        if (!policy) {
          throw new BadRequestError('Recording policy not found');
        }
      }
      if (parsed.data.streamProfileId) {
        const profile = await ctx.repos.streamProfiles.findById(
          ctx.organizationId,
          parsed.data.streamProfileId
        );
        if (!profile) {
          throw new BadRequestError('Stream profile not found');
        }
      }
      if (parsed.data.audioFeedProfileId) {
        const profile = await ctx.repos.audioFeedProfiles.findById(
          ctx.organizationId,
          parsed.data.audioFeedProfileId
        );
        if (!profile) {
          throw new BadRequestError('Audio feed profile not found');
        }
      }
      const input = await ctx.repos.inputs.update(ctx.organizationId, req.params.id, parsed.data);
      if (!input) {
        throw new NotFoundError('Input not found');
      }
      await afterRoutingMutation(ctx.gateway, 'input.updated', input.id);
      res.json(input);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
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
