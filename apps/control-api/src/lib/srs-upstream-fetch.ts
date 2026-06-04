import { config } from '../config';

const SRS_BASE = () => config.srsPlaybackBaseUrl.replace(/\/$/, '');

function vhostQuerySuffixes(): string[] {
  const suffixes = new Set<string>(['', '?vhost=localhost', '?vhost=__defaultVhost__']);
  try {
    const host = new URL(config.publicAppUrl).hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      suffixes.add(`?vhost=${encodeURIComponent(host)}`);
    }
  } catch {
    // ignore invalid PUBLIC_APP_URL
  }
  try {
    const rtmpHost = new URL(config.srsRtmpForwardBase).hostname;
    if (rtmpHost && rtmpHost !== 'localhost' && rtmpHost !== '127.0.0.1') {
      suffixes.add(`?vhost=${encodeURIComponent(rtmpHost)}`);
    }
  } catch {
    // ignore invalid SRS_RTMP_FORWARD_BASE
  }
  return [...suffixes];
}

function withVhostQueries(path: string): string[] {
  const base = path.split('?')[0] ?? path;
  return vhostQuerySuffixes().map((q) => (q ? `${base}${q}` : base));
}

interface SrsStreamRow {
  name?: string;
  app?: string;
  vhost?: string;
  url?: string;
  publish?: { active?: boolean; vhost?: string };
}

async function discoverPathsFromSrsApi(
  app: string,
  stream: string,
  ext: string
): Promise<string[]> {
  try {
    const apiBase = config.srsHttpApiUrl.replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/v1/streams/?count=100`);
    if (!response.ok) return [];
    const data = (await response.json()) as { streams?: SrsStreamRow[] };
    const row = (data.streams ?? []).find(
      (s) =>
        (s.app ?? 'live').replace(/^\/+|\/+$/g, '') === app &&
        (s.name ?? '') === stream &&
        s.publish?.active !== false
    );
    if (!row) return [];

    const paths: string[] = [];
    const vhosts = new Set<string>();
    if (row.vhost) vhosts.add(row.vhost);
    if (row.publish?.vhost) vhosts.add(row.publish.vhost);

    for (const vhost of vhosts) {
      paths.push(`/${app}/${stream}.${ext}?vhost=${encodeURIComponent(vhost)}`);
    }
    if (typeof row.url === 'string' && row.url.startsWith('/')) {
      const base = row.url.replace(/\/$/, '');
      paths.push(`${base}.${ext}`);
      for (const vhost of vhosts) {
        paths.push(`${base}.${ext}?vhost=${encodeURIComponent(vhost)}`);
      }
    }
    return paths;
  } catch {
    return [];
  }
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
  const extMatch = pathOnly.match(/\.(m3u8|flv|ts)$/i);
  const ext = extMatch?.[1] ?? 'flv';
  const appStream = pathOnly.match(/^\/([^/]+)\/([^/]+)\./);
  const discovered =
    appStream && appStream[1] && appStream[2]
      ? await discoverPathsFromSrsApi(appStream[1], appStream[2], ext)
      : [];

  const candidates = [...new Set([...discovered, ...srsUpstreamCandidates(pathOnly)])];

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
