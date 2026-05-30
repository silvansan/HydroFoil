import { Router } from 'express';

import type { AppContext } from '../context';
import { asyncHandler } from '../middleware/async-handler';

export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      await ctx.db.query('SELECT 1');
      res.json({
        status: 'ok',
        database: 'ok',
        organizationId: ctx.organizationId,
        timestamp: new Date().toISOString(),
      });
    })
  );

  return router;
}
