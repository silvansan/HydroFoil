import type { Plugin } from 'vite';
import http from 'node:http';
import https from 'node:https';

/** SPA routes — do not proxy to SRS. */
const SPA_PREFIXES = [
  '/api',
  '/@',
  '/node_modules',
  '/src',
  '/vite',
  '/inputs',
  '/outputs',
  '/routes',
  '/domain-blocks',
  '/recordings',
  '/live-sessions',
  '/storage',
  '/system-status',
  '/stream-keys',
];

function isSpaRoute(pathname: string): boolean {
  return SPA_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Rewrite absolute SRS paths so segment requests stay under /srs-media (Vite dev). */
export function rewriteM3u8Playlist(body: string): string {
  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
      if (trimmed.startsWith('/srs-media/')) return line;
      if (trimmed.startsWith('/')) return `/srs-media${trimmed}`;
      return line;
    })
    .join('\n');
}

function srsUpstreamPath(pathname: string, search: string): string {
  const base = pathname.startsWith('/srs-media')
    ? pathname.replace(/^\/srs-media/, '') || '/'
    : pathname;
  return `${base}${search}`;
}

function fetchFromSrs(target: string, pathWithQuery: string): Promise<{ status: number; body: Buffer; contentType?: string }> {
  const url = new URL(pathWithQuery, target.endsWith('/') ? target : `${target}/`);
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    client
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 502,
            body: Buffer.concat(chunks),
            contentType: res.headers['content-type'] as string | undefined,
          });
        });
      })
      .on('error', reject);
  });
}

/**
 * Dev-only: proxy HLS/FLV/TS to SRS and rewrite playlists so child URLs use /srs-media.
 * Without this, SRS absolute paths like /gtch/key.m3u8 hit the Vite SPA and playback fails.
 */
export function srsPlaybackProxyPlugin(srsTarget: string): Plugin {
  return {
    name: 'hydrofoil-srs-playback-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? '/';
          const qIndex = rawUrl.indexOf('?');
          const pathname = qIndex >= 0 ? rawUrl.slice(0, qIndex) : rawUrl;
          const search = qIndex >= 0 ? rawUrl.slice(qIndex) : '';

          if (!/\.(m3u8|ts|flv)$/i.test(pathname)) return next();
          if (isSpaRoute(pathname)) return next();

          const upstream = srsUpstreamPath(pathname, search);
          const { status, body, contentType } = await fetchFromSrs(srsTarget, upstream);

          let payload = body;
          if (pathname.endsWith('.m3u8') && status >= 200 && status < 300) {
            payload = Buffer.from(rewriteM3u8Playlist(body.toString('utf8')), 'utf8');
          }

          res.statusCode = status;
          if (contentType) res.setHeader('Content-Type', contentType);
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(payload);
        } catch {
          next();
        }
      });
    },
  };
}
