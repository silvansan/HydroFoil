import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { afterRoutingMutation } from '../lib/routing-mutations';
import { parsePagination } from '../lib/pagination';
import { formatZodError } from '../lib/zod-errors';

const createRouteSchema = z.object({
  inputId: z.string().uuid(),
  name: z.string().min(1),
  outputIds: z.array(z.string().uuid()).min(1),
  streamProfileId: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
});

export function createRoutesRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.routes.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const route = await ctx.repos.routes.findById(ctx.organizationId, req.params.id);
      if (!route) throw new NotFoundError('Route not found');
      res.json(route);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createRouteSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const route = await ctx.repos.routes.create(ctx.organizationId, parsed.data);
      await afterRoutingMutation(ctx.gateway, 'route.created', route.id);
      res.status(201).json(route);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = createRouteSchema.partial().safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const route = await ctx.repos.routes.update(ctx.organizationId, req.params.id, parsed.data);
      if (!route) throw new NotFoundError('Route not found');
      await afterRoutingMutation(ctx.gateway, 'route.updated', route.id);
      res.json(route);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const deleted = await ctx.repos.routes.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Route not found');
      await afterRoutingMutation(ctx.gateway, 'route.deleted', req.params.id);
      res.status(204).send();
    })
  );

  return router;
}
