import type { Response } from 'express';

import { fetchFromSrsUpstream } from './srs-upstream-fetch';
import { rewriteM3u8PlaylistForProxy } from './srs-m3u8-rewrite';
import { upstreamPathsForResource } from '../services/playback-resolver';

export async function proxySrsMediaToResponse(
  resource: string,
  res: Response,
  options?: { rewriteM3u8Prefix?: string; rewritePlaylist?: (body: string) => string }
) {
  const pathOnly = resource.split('?')[0] ?? resource;
  const match = pathOnly.match(/^([^/]+)\/([^/]+)\.(m3u8|flv|ts)$/i);
  let preferredPaths: string[] | undefined;
  if (match) {
    const [, app, filename, ext] = match;
    const stream = filename.replace(/\.(m3u8|flv|ts)$/i, '');
    preferredPaths = await upstreamPathsForResource(
      app,
      stream,
      ext.toLowerCase() as 'm3u8' | 'flv' | 'ts'
    );
  }

  const query = resource.includes('?') ? resource.slice(resource.indexOf('?')) : '';
  const proxied = await fetchFromSrsUpstream(`${pathOnly}${query}`, { preferredPaths });

  let payload = proxied.body;
  if (
    pathOnly.endsWith('.m3u8') &&
    proxied.status >= 200 &&
    proxied.status < 300
  ) {
    const body = proxied.body.toString('utf8');
    payload = Buffer.from(
      options?.rewritePlaylist?.(body) ??
        rewriteM3u8PlaylistForProxy(body, options?.rewriteM3u8Prefix ?? '/srs-media'),
      'utf8'
    );
  }

  res.status(proxied.status);
  if (proxied.contentType) {
    res.setHeader('Content-Type', proxied.contentType);
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(payload);
}
