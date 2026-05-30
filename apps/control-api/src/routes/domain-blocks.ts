import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';

const createDomainBlockSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  allowedDomains: z.array(z.string()).min(1),
  branding: z
    .object({
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
  playbackAccessPolicy: z.enum(['public', 'token-required', 'restricted']),
  tokenRequired: z.boolean().optional(),
});

export function createDomainBlocksRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.domainBlocks.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const block = await ctx.repos.domainBlocks.findById(ctx.organizationId, req.params.id);
      if (!block) throw new NotFoundError('Domain block not found');
      res.json(block);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createDomainBlockSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);
      res.status(201).json(await ctx.repos.domainBlocks.create(ctx.organizationId, parsed.data));
    })
  );

  return router;
}
