import type { Request, Response } from 'express';
import { Router } from 'express';

import { fetchFromSrsUpstream } from '../lib/srs-upstream-fetch';
import { rewriteM3u8PlaylistForProxy } from '../lib/srs-m3u8-rewrite';

export function createSrsMediaProxyRouter(): Router {
  const router = Router();

  router.get(/.*/, async (req: Request, res: Response) => {
    const resource = req.path.replace(/^\/+/, '');
    if (!resource || !/\.(m3u8|ts|flv)$/i.test(resource)) {
      res.status(404).send('Not Found');
      return;
    }

    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const proxied = await fetchFromSrsUpstream(`${resource}${query}`);

    let payload = proxied.body;
    if (resource.endsWith('.m3u8') && proxied.status >= 200 && proxied.status < 300) {
      payload = Buffer.from(rewriteM3u8PlaylistForProxy(proxied.body.toString('utf8')), 'utf8');
    }

    res.status(proxied.status);
    if (proxied.contentType) {
      res.setHeader('Content-Type', proxied.contentType);
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(payload);
  });

  return router;
}
