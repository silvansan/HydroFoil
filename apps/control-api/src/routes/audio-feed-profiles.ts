import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';

const createAudioFeedSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  outputCodecs: z.array(z.enum(['mp3', 'aac', 'opus'])).min(1),
  outputContainer: z.enum(['mp3', 'aac', 'ogg', 'hls']),
  storageLocationId: z.string().uuid(),
  nameTemplate: z.string().min(1),
  generateDuringLive: z.boolean().optional(),
});

const updateAudioFeedSchema = createAudioFeedSchema.partial();

export function createAudioFeedProfilesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.audioFeedProfiles.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const profile = await ctx.repos.audioFeedProfiles.findById(ctx.organizationId, req.params.id);
      if (!profile) throw new NotFoundError('Audio feed profile not found');
      res.json(profile);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createAudioFeedSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      const location = await ctx.repos.storageLocations.findById(
        ctx.organizationId,
        parsed.data.storageLocationId
      );
      if (!location) throw new BadRequestError('Storage location not found');

      res.status(201).json(
        await ctx.repos.audioFeedProfiles.create(ctx.organizationId, parsed.data)
      );
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateAudioFeedSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      if (parsed.data.storageLocationId) {
        const location = await ctx.repos.storageLocations.findById(
          ctx.organizationId,
          parsed.data.storageLocationId
        );
        if (!location) throw new BadRequestError('Storage location not found');
      }

      const updated = await ctx.repos.audioFeedProfiles.update(
        ctx.organizationId,
        req.params.id,
        parsed.data
      );
      if (!updated) throw new NotFoundError('Audio feed profile not found');
      res.json(updated);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await ctx.repos.audioFeedProfiles.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Audio feed profile not found');
      res.status(204).send();
    })
  );

  return router;
}
