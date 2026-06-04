import type { Request, Response } from 'express';
import { Router } from 'express';

import { config } from '../config';
import { rewriteM3u8PlaylistForProxy } from '../lib/srs-m3u8-rewrite';

const SRS_BASE = () => config.srsPlaybackBaseUrl.replace(/\/$/, '');

function upstreamCandidates(pathname: string): string[] {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const candidates = [normalized];
  // Default SRS app "live" is often published as /live/{stream}.m3u8
  if (/^\/live\/[^/]+\.m3u8$/i.test(normalized)) {
    const alt = normalized.replace(/^\/live\//, '/');
    if (!candidates.includes(alt)) candidates.push(alt);
  } else if (/^\/[^/]+\/[^/]+\.m3u8$/i.test(normalized)) {
    const alt = `/live${normalized}`;
    if (!candidates.includes(alt)) candidates.push(alt);
  }
  return candidates;
}

async function fetchFromSrs(pathWithQuery: string): Promise<{
  status: number;
  contentType?: string;
  body: Buffer;
}> {
  const base = SRS_BASE();
  let lastStatus = 404;
  let lastContentType: string | undefined;
  let lastBody = Buffer.alloc(0);

  const pathOnly = pathWithQuery.split('?')[0] ?? pathWithQuery;
  const query = pathWithQuery.includes('?') ? pathWithQuery.slice(pathWithQuery.indexOf('?')) : '';
  const paths = pathOnly.endsWith('.m3u8') ? upstreamCandidates(pathOnly) : [pathOnly];

  for (const candidate of paths) {
    const upstreamUrl = new URL(`${candidate}${query}`.replace(/^\/+/, ''), `${base}/`);
    const response = await fetch(upstreamUrl);
    lastStatus = response.status;
    lastContentType = response.headers.get('content-type') ?? undefined;
    lastBody = Buffer.from(await response.arrayBuffer());
    if (lastStatus >= 200 && lastStatus < 300) {
      return { status: lastStatus, contentType: lastContentType, body: lastBody };
    }
  }

  return { status: lastStatus, contentType: lastContentType, body: lastBody };
}

export function createSrsMediaProxyRouter(): Router {
  const router = Router();

  router.get(/.*/, async (req: Request, res: Response) => {
    const resource = req.path.replace(/^\/+/, '');
    if (!resource || !/\.(m3u8|ts|flv)$/i.test(resource)) {
      res.status(404).send('Not Found');
      return;
    }

    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const proxied = await fetchFromSrs(`${resource}${query}`);

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
