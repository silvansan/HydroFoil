import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';
import { NotFoundError } from '../errors';

const createWatchlistSchema = z.object({
  applicationName: z.string().min(1, 'Application name is required'),
  streamPattern: z.string().optional().default('*'),
  retentionHours: z.number().int().min(1).optional().default(24),
  storageLocationId: z.string().uuid('Invalid storage location ID'),
  enabled: z.boolean().optional().default(true),
});

const updateWatchlistSchema = z.object({
  streamPattern: z.string().optional(),
  retentionHours: z.number().int().min(1).optional(),
  storageLocationId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
});

export function createDvrWatchlistRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const watchlist = await ctx.repos.dvrWatchlist.list(
        ctx.organizationId,
        parsePagination(req)
      );
      res.json(watchlist);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const data = createWatchlistSchema.parse(req.body);

      // Verify storage location exists and belongs to org
      const storage = await ctx.repos.storageLocations.findById(
        ctx.organizationId,
        data.storageLocationId
      );
      if (!storage) {
        throw new NotFoundError('Storage location not found');
      }

      const entry = await ctx.repos.dvrWatchlist.create(ctx.organizationId, data);
      res.status(201).json(entry);
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const entry = await ctx.repos.dvrWatchlist.findById(ctx.organizationId, req.params.id);
      if (!entry) {
        throw new NotFoundError('DVR watchlist entry not found');
      }
      res.json(entry);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const entry = await ctx.repos.dvrWatchlist.findById(ctx.organizationId, req.params.id);
      if (!entry) {
        throw new NotFoundError('DVR watchlist entry not found');
      }

      const data = updateWatchlistSchema.parse(req.body);

      // Verify storage location if being updated
      if (data.storageLocationId) {
        const storage = await ctx.repos.storageLocations.findById(
          ctx.organizationId,
          data.storageLocationId
        );
        if (!storage) {
          throw new NotFoundError('Storage location not found');
        }
      }

      const updated = await ctx.repos.dvrWatchlist.update(ctx.organizationId, req.params.id, data);
      res.json(updated);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const entry = await ctx.repos.dvrWatchlist.findById(ctx.organizationId, req.params.id);
      if (!entry) {
        throw new NotFoundError('DVR watchlist entry not found');
      }
      await ctx.repos.dvrWatchlist.delete(ctx.organizationId, req.params.id);
      res.status(204).end();
    })
  );

  return router;
}
