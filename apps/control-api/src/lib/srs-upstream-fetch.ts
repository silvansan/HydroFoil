import { config } from '../config';

const SRS_BASE = () => config.srsPlaybackBaseUrl.replace(/\/$/, '');

const VHOST_QUERIES = ['', '?vhost=localhost', '?vhost=__defaultVhost__'];

function withVhostQueries(path: string): string[] {
  const base = path.split('?')[0] ?? path;
  return VHOST_QUERIES.map((q) => (q ? `${base}${q}` : base));
}

/** Candidate HTTP paths on SRS for a given app/stream media file. */
export function srsUpstreamCandidates(pathname: string): string[] {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const seen = new Set<string>();
  const add = (path: string) => {
    for (const candidate of withVhostQueries(path)) {
      if (!seen.has(candidate)) seen.add(candidate);
    }
  };

  add(normalized);

  const match = normalized.match(/^\/([^/]+)\/([^/]+)\.(m3u8|flv|ts)$/i);
  if (match) {
    const [, app, filename, ext] = match;
    const stream = filename.replace(/\.(m3u8|flv|ts)$/i, '');
    if (app === 'live') {
      add(`/live/${stream}.${ext}`);
    } else {
      add(`/live/${app}/${stream}.${ext}`);
      add(`/live/${stream}.${ext}`);
    }
  } else if (/^\/live\/([^/]+)\.(m3u8|flv|ts)$/i.test(normalized)) {
    const alt = normalized.replace(/^\/live\//, '/');
    add(alt);
  }

  return [...seen];
}

export async function fetchFromSrsUpstream(pathWithQuery: string): Promise<{
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
  const candidates = srsUpstreamCandidates(pathOnly);

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
