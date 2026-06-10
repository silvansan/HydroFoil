import type { Request, Response } from 'express';
import { Router } from 'express';

import type { AppContext } from '../context';
import { asyncHandler } from '../middleware/async-handler';
import { enforcePlaybackAccess } from '../lib/playback-access';
import { proxySrsMediaToResponse } from '../lib/proxy-srs-media';

function setSrsMediaCors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
}

function parseMediaResource(resource: string): { app: string; stream: string } | null {
  const match = resource.match(/^([^/]+)\/([^/]+)\.(m3u8|flv|ts)$/i);
  if (!match) return null;
  const [, app, filename] = match;
  const stream = filename.replace(/\.(m3u8|flv|ts)$/i, '');
  return { app, stream };
}

export function createSrsMediaProxyRouter(ctx: AppContext): Router {
  const router = Router();

  router.options(/.*/, (_req: Request, res: Response) => {
    setSrsMediaCors(res);
    res.status(204).end();
  });

  router.get(
    /.*/,
    asyncHandler(async (req: Request, res: Response) => {
      const resource = req.path.replace(/^\/+/, '');
      if (!resource || !/\.(m3u8|ts|flv)$/i.test(resource)) {
        setSrsMediaCors(res);
        res.status(404).send('Not Found');
        return;
      }

      const parsed = parseMediaResource(resource);
      if (parsed) {
        await enforcePlaybackAccess(ctx, parsed.app, parsed.stream, req);
      }

      await proxySrsMediaToResponse(resource, res);
    })
  );

  return router;
}
