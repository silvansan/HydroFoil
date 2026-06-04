import { config } from '../config';
import {
  buildLegacyFlvPath,
  buildUpstreamMediaPath,
  findSrsStream,
  listSrsStreams,
  resolveStreamVhost,
  upstreamPathsForResource,
} from '../services/playback-resolver';

const SRS_BASE = () => config.srsPlaybackBaseUrl.replace(/\/$/, '');

function vhostQuerySuffixes(vhost: string): string[] {
  const suffixes = new Set<string>(['', `?vhost=${encodeURIComponent(vhost)}`]);
  if (vhost !== 'localhost') suffixes.add('?vhost=localhost');
  if (vhost !== '__defaultVhost__') suffixes.add('?vhost=__defaultVhost__');
  try {
    const host = new URL(config.publicAppUrl).hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      suffixes.add(`?vhost=${encodeURIComponent(host)}`);
    }
  } catch {
    // ignore
  }
  return [...suffixes];
}

function withVhostQueries(path: string, vhost: string): string[] {
  const base = path.split('?')[0] ?? path;
  return vhostQuerySuffixes(vhost).map((q) => (q ? `${base}${q}` : base));
}

/** Fallback candidates when SRS API is unavailable. */
export function srsUpstreamCandidates(pathname: string, vhost = '__defaultVhost__'): string[] {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const seen = new Set<string>();
  const add = (path: string) => {
    for (const candidate of withVhostQueries(path, vhost)) {
      if (!seen.has(candidate)) seen.add(candidate);
    }
  };

  add(normalized);

  const match = normalized.match(/^\/([^/]+)\/([^/]+)\.(m3u8|flv|ts)$/i);
  if (match) {
    const [, app, filename, ext] = match;
    const stream = filename.replace(/\.(m3u8|flv|ts)$/i, '');
    add(buildUpstreamMediaPath(app, stream, vhost, ext as 'm3u8' | 'flv' | 'ts'));
    if (ext.toLowerCase() === 'flv') {
      add(buildLegacyFlvPath(app, stream, vhost));
    }
    if (app === 'live') {
      add(`/live/${stream}.${ext}`);
    } else {
      add(`/live/${app}/${stream}.${ext}`);
      add(`/live/${stream}.${ext}`);
    }
  } else if (/^\/live\/([^/]+)\.(m3u8|flv|ts)$/i.test(normalized)) {
    add(normalized.replace(/^\/live\//, '/'));
  }

  return [...seen];
}

async function resolverCandidates(pathOnly: string): Promise<string[]> {
  const match = pathOnly.match(/^\/([^/]+)\/([^/]+)\.(m3u8|flv|ts)$/i);
  if (!match) return [];
  const [, app, filename, ext] = match;
  const stream = filename.replace(/\.(m3u8|flv|ts)$/i, '');
  return upstreamPathsForResource(app, stream, ext.toLowerCase() as 'm3u8' | 'flv' | 'ts');
}

export type FetchFromSrsOptions = {
  preferredPaths?: string[];
};

export async function fetchFromSrsUpstream(
  pathWithQuery: string,
  options?: FetchFromSrsOptions
): Promise<{
  status: number;
  contentType?: string;
  body: Buffer;
  resolvedPath?: string;
}> {
  const base = SRS_BASE();
  const pathOnly = pathWithQuery.split('?')[0] ?? pathWithQuery;
  const extraQuery = pathWithQuery.includes('?')
    ? pathWithQuery.slice(pathWithQuery.indexOf('?'))
    : '';

  const resolved = await resolverCandidates(pathOnly);
  const streams = await listSrsStreams();
  const appStream = pathOnly.match(/^\/([^/]+)\/([^/]+)\./);
  const row =
    appStream && appStream[1] && appStream[2]
      ? findSrsStream(streams, appStream[1], appStream[2])
      : undefined;
  const vhost = row ? resolveStreamVhost(row) : '__defaultVhost__';

  const candidates = [
    ...new Set([
      ...(options?.preferredPaths ?? []),
      ...resolved,
      ...srsUpstreamCandidates(pathOnly, vhost),
    ]),
  ];

  let lastStatus = 404;
  let lastContentType: string | undefined;
  let lastBody = Buffer.alloc(0);

  for (const candidate of candidates) {
    const merged = candidate.includes('?')
      ? candidate
      : `${candidate}${extraQuery && !candidate.includes('?') ? extraQuery : ''}`;
    const upstreamUrl = new URL(merged.replace(/^\/+/, ''), `${base}/`);
    const response = await fetch(upstreamUrl);
    lastStatus = response.status;
    lastContentType = response.headers.get('content-type') ?? undefined;
    lastBody = Buffer.from(await response.arrayBuffer());
    if (lastStatus >= 200 && lastStatus < 300) {
      return {
        status: lastStatus,
        contentType: lastContentType,
        body: lastBody,
        resolvedPath: merged,
      };
    }
  }

  return { status: lastStatus, contentType: lastContentType, body: lastBody };
}
