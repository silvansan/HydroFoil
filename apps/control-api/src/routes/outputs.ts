import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { afterRoutingMutation } from '../lib/routing-mutations';
import { parsePagination } from '../lib/pagination';
import { formatZodError } from '../lib/zod-errors';

const createOutputSchema = z.object({
  name: z.string().min(1),
  routeTarget: z.string().min(1),
  playbackProtocol: z.enum(['hls', 'dash', 'rtmp', 'http-flv']),
  gatewayAppName: z.string().min(1),
  gatewayStreamName: z.string().min(1),
  domainBlockId: z.string().uuid().optional(),
  streamProfileId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export function createOutputsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.outputs.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const output = await ctx.repos.outputs.findById(ctx.organizationId, req.params.id);
      if (!output) throw new NotFoundError('Output not found');
      res.json(output);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createOutputSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const output = await ctx.repos.outputs.create(ctx.organizationId, parsed.data);
      await afterRoutingMutation(ctx.gateway, 'output.created', output.id);
      res.status(201).json(output);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = createOutputSchema.partial().safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const output = await ctx.repos.outputs.update(ctx.organizationId, req.params.id, parsed.data);
      if (!output) throw new NotFoundError('Output not found');
      await afterRoutingMutation(ctx.gateway, 'output.updated', output.id);
      res.json(output);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await ctx.repos.outputs.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Output not found');
      await afterRoutingMutation(ctx.gateway, 'output.deleted', req.params.id);
      res.status(204).send();
    })
  );

  return router;
}
