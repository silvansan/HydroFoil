import type { Request, Response } from 'express';
import { Router } from 'express';

import { proxySrsMediaToResponse } from '../lib/proxy-srs-media';

export function createSrsMediaProxyRouter(): Router {
  const router = Router();

  router.get(/.*/, async (req: Request, res: Response) => {
    const resource = req.path.replace(/^\/+/, '');
    if (!resource || !/\.(m3u8|ts|flv)$/i.test(resource)) {
      res.status(404).send('Not Found');
      return;
    }

    await proxySrsMediaToResponse(resource, res);
  });

  return router;
}
