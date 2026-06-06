import type { Request, Response } from 'express';
import { Router } from 'express';

import { proxySrsMediaToResponse } from '../lib/proxy-srs-media';

function setSrsMediaCors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
}

export function createSrsMediaProxyRouter(): Router {
  const router = Router();

  router.options(/.*/, (_req: Request, res: Response) => {
    setSrsMediaCors(res);
    res.status(204).end();
  });

  router.get(/.*/, async (req: Request, res: Response) => {
    const resource = req.path.replace(/^\/+/, '');
    if (!resource || !/\.(m3u8|ts|flv)$/i.test(resource)) {
      setSrsMediaCors(res);
      res.status(404).send('Not Found');
      return;
    }

    await proxySrsMediaToResponse(resource, res);
  });

  return router;
}
