import { Router } from 'express';

import type { AppContext } from '../context';
import { asyncHandler } from '../middleware/async-handler';
import { getBandwidthHistory, getCpuHistory } from '../services/bandwidth-history';
import { systemTelemetryService } from '../services/system-telemetry';

export function createSystemRouter(_ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/telemetry',
    asyncHandler(async (_req, res) => {
      res.json(await systemTelemetryService.collect());
    })
  );

  router.get(
    '/bandwidth-history',
    asyncHandler(async (req, res) => {
      const rawHours = Number(req.query.hours ?? 24);
      const hours = Number.isFinite(rawHours) ? rawHours : 24;
      res.json(getBandwidthHistory(hours));
    })
  );

  router.get(
    '/cpu-history',
    asyncHandler(async (req, res) => {
      const rawHours = Number(req.query.hours ?? 24);
      const hours = Number.isFinite(rawHours) ? rawHours : 24;
      res.json(getCpuHistory(hours));
    })
  );

  return router;
}
