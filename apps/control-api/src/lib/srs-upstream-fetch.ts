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

/** Merge SRS session query params (e.g. hls_ctx) from the client request into upstream candidates. */
export function mergeUpstreamRequestQuery(candidate: string, requestQuery: string): string {
  const [candidatePath, candidateSearch = ''] = candidate.split('?');
  if (!requestQuery || requestQuery === '?') {
    return candidate;
  }
  const requestParams = new URLSearchParams(
    requestQuery.startsWith('?') ? requestQuery.slice(1) : requestQuery
  );
  const candidateParams = new URLSearchParams(candidateSearch);
  for (const [key, value] of requestParams) {
    candidateParams.set(key, value);
  }
  const merged = candidateParams.toString();
  return merged ? `${candidatePath}?${merged}` : candidatePath;
}

/** Express mounted routers pass paths without a leading slash — SRS resolution requires one. */
export function normalizeUpstreamMediaPath(pathWithQuery: string): string {
  const queryIndex = pathWithQuery.indexOf('?');
  const pathOnly = (queryIndex >= 0 ? pathWithQuery.slice(0, queryIndex) : pathWithQuery).replace(
    /^\/+/,
    ''
  );
  const query = queryIndex >= 0 ? pathWithQuery.slice(queryIndex) : '';
  return `/${pathOnly}${query}`;
}

function publicHostnames(): string[] {
  const hosts = new Set<string>();
  for (const raw of [config.publicAppUrl, config.srsRtmpForwardBase]) {
    try {
      const host = new URL(raw).hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        hosts.add(host);
      }
    } catch {
      // ignore
    }
  }
  return [...hosts];
}

function vhostQuerySuffixes(vhost: string): string[] {
  const suffixes = new Set<string>(['', `?vhost=${encodeURIComponent(vhost)}`]);
  if (vhost !== 'localhost') suffixes.add('?vhost=localhost');
  if (vhost !== '__defaultVhost__') suffixes.add('?vhost=__defaultVhost__');
  for (const host of publicHostnames()) {
    suffixes.add(`?vhost=${encodeURIComponent(host)}`);
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

function isHlsMediaPlaylist(body: string): boolean {
  return body.includes('#EXTINF:');
}

/** Probe SRS using the same upstream fallbacks as /srs-media proxy. */
export async function probeUpstreamMedia(pathOnly: string): Promise<boolean> {
  try {
    const normalized = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const result = await fetchFromSrsUpstream(normalized);
    if (result.status < 200 || result.status >= 300) return false;
    if (/\.m3u8/i.test(normalized)) {
      return isHlsMediaPlaylist(result.body.toString('utf8'));
    }
    return true;
  } catch {
    return false;
  }
}

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
  const normalizedPath = normalizeUpstreamMediaPath(pathWithQuery);
  const pathOnly = normalizedPath.split('?')[0] ?? normalizedPath;
  const extraQuery = normalizedPath.includes('?')
    ? normalizedPath.slice(normalizedPath.indexOf('?'))
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
      normalizedPath,
      ...(options?.preferredPaths ?? []),
      ...resolved,
      ...srsUpstreamCandidates(pathOnly, vhost),
    ]),
  ];

  let lastStatus = 404;
  let lastContentType: string | undefined;
  let lastBody = Buffer.alloc(0);
  let fallbackMaster: {
    status: number;
    contentType?: string;
    body: Buffer;
    resolvedPath?: string;
  } | null = null;

  for (const candidate of candidates) {
    const merged = mergeUpstreamRequestQuery(candidate, extraQuery);
    const upstreamUrl = new URL(merged.replace(/^\/+/, ''), `${base}/`);
    const response = await fetch(upstreamUrl);
    lastStatus = response.status;
    lastContentType = response.headers.get('content-type') ?? undefined;
    lastBody = Buffer.from(await response.arrayBuffer());
    if (lastStatus >= 200 && lastStatus < 300) {
      const payload = {
        status: lastStatus,
        contentType: lastContentType,
        body: lastBody,
        resolvedPath: merged,
      };
      if (pathOnly.endsWith('.m3u8')) {
        if (isHlsMediaPlaylist(lastBody.toString('utf8'))) {
          return payload;
        }
        if (!fallbackMaster) fallbackMaster = payload;
        continue;
      }
      return payload;
    }
  }

  if (fallbackMaster) return fallbackMaster;
  return { status: lastStatus, contentType: lastContentType, body: lastBody };
}
