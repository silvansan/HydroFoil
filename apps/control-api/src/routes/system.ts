import { Router } from 'express';

import type { AppContext } from '../context';
import { getOperatorPublicUrls } from '../lib/operator-public-urls';
import { asyncHandler } from '../middleware/async-handler';
import { systemTelemetryService } from '../services/system-telemetry';

export function createSystemRouter(_ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/public-urls',
    asyncHandler(async (_req, res) => {
      res.json(getOperatorPublicUrls());
    })
  );

  router.get(
    '/telemetry',
    asyncHandler(async (_req, res) => {
      res.json(await systemTelemetryService.collect());
    })
  );

  return router;
}
