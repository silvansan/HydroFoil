import { buildTranscodeGatewayMapping } from '@hydrofoil/domain';
import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { afterRoutingMutation } from '../lib/routing-mutations';
import { parsePagination } from '../lib/pagination';

const renditionSchema = z.object({
  name: z.string().min(1),
  videoBitrate: z.number().positive(),
  videoCodec: z.string().min(1),
  resolution: z.string().min(1),
  fps: z.number().positive(),
});

const createStreamProfileSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(['passthrough', 'transcode']),
  renditions: renditionSchema.array(),
  audioHandling: z.enum(['copy', 'aac', 'opus']),
  gatewayMapping: z.record(z.unknown()).optional(),
});

const updateStreamProfileSchema = createStreamProfileSchema.partial();

export function createStreamProfilesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.streamProfiles.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const profile = await ctx.repos.streamProfiles.findById(ctx.organizationId, req.params.id);
      if (!profile) throw new NotFoundError('Stream profile not found');
      res.json(profile);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createStreamProfileSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);
      if (parsed.data.mode === 'transcode' && parsed.data.renditions.length === 0) {
        throw new BadRequestError('Transcode profiles require at least one rendition');
      }
      const gatewayMapping =
        parsed.data.gatewayMapping ??
        (parsed.data.mode === 'transcode'
          ? buildTranscodeGatewayMapping({
              ...parsed.data,
              id: '',
              organizationId: ctx.organizationId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          : undefined);
      const profile = await ctx.repos.streamProfiles.create(ctx.organizationId, {
        ...parsed.data,
        gatewayMapping,
      });
      await afterRoutingMutation(ctx.gateway, 'stream-profile.created', String(profile.id));
      res.status(201).json(profile);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateStreamProfileSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);
      const existing = await ctx.repos.streamProfiles.findById(ctx.organizationId, req.params.id);
      if (!existing) throw new NotFoundError('Stream profile not found');

      const merged = {
        ...existing,
        ...parsed.data,
        organizationId: String(existing.organizationId),
        id: String(existing.id),
        createdAt:
          existing.createdAt instanceof Date
            ? existing.createdAt
            : new Date(String(existing.createdAt)),
        updatedAt:
          existing.updatedAt instanceof Date
            ? existing.updatedAt
            : new Date(String(existing.updatedAt)),
      };
      const gatewayMapping =
        parsed.data.gatewayMapping ??
        (merged.mode === 'transcode' && parsed.data.renditions
          ? buildTranscodeGatewayMapping(merged as import('@hydrofoil/shared-types').StreamProfile)
          : parsed.data.gatewayMapping);

      const updated = await ctx.repos.streamProfiles.update(
        ctx.organizationId,
        req.params.id,
        { ...parsed.data, ...(gatewayMapping ? { gatewayMapping } : {}) }
      );
      if (!updated) throw new NotFoundError('Stream profile not found');
      await afterRoutingMutation(ctx.gateway, 'stream-profile.updated', String(updated.id));
      res.json(updated);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await ctx.repos.streamProfiles.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Stream profile not found');
      await afterRoutingMutation(ctx.gateway, 'stream-profile.deleted', req.params.id);
      res.status(204).send();
    })
  );

  return router;
}
