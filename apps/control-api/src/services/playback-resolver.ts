import { config } from '../config';

export interface SrsStreamRow {
  name?: string;
  app?: string;
  vhost?: string;
  url?: string;
  publish?: { active?: boolean; vhost?: string };
}

export interface ResolvedLivePlayback {
  active: boolean;
  playable: boolean;
  vhost: string;
  app: string;
  stream: string;
  upstreamHls: string;
  upstreamFlv: string;
  srsMediaHls: string;
  srsMediaFlv: string;
  protectedHls: string;
  protectedFlv: string;
}

function normalizeApp(app: string) {
  return app.replace(/^\/+|\/+$/g, '') || 'live';
}

export function resolveStreamVhost(row: SrsStreamRow): string {
  return row.publish?.vhost ?? row.vhost ?? '__defaultVhost__';
}

/** Canonical SRS HTTP paths (aligned with hls m3u8=[app]/[stream].m3u8 and remux [app]/[stream].flv). */
export function buildUpstreamMediaPath(
  app: string,
  stream: string,
  vhost: string,
  ext: 'm3u8' | 'flv' | 'ts'
): string {
  const safeApp = normalizeApp(app);
  const query = `?vhost=${encodeURIComponent(vhost)}`;
  return `/${safeApp}/${stream}.${ext}${query}`;
}

/** Legacy remux mount [vhost]/[app]/[stream].flv — kept as fallback until all SRS configs are redeployed. */
export function buildLegacyFlvPath(app: string, stream: string, vhost: string): string {
  const safeApp = normalizeApp(app);
  const query = `?vhost=${encodeURIComponent(vhost)}`;
  return `/${vhost}/${safeApp}/${stream}.flv${query}`;
}

export async function listSrsStreams(): Promise<SrsStreamRow[]> {
  try {
    const apiBase = config.srsHttpApiUrl.replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/v1/streams/?count=200`);
    if (!response.ok) return [];
    const data = (await response.json()) as { streams?: SrsStreamRow[] };
    return data.streams ?? [];
  } catch {
    return [];
  }
}

export function findSrsStream(
  streams: SrsStreamRow[],
  app: string,
  stream: string
): SrsStreamRow | undefined {
  const safeApp = normalizeApp(app);
  return streams.find(
    (row) => normalizeApp(row.app ?? 'live') === safeApp && (row.name ?? '') === stream
  );
}

export async function probeUpstreamPlayable(upstreamPath: string): Promise<boolean> {
  try {
    const base = config.srsPlaybackBaseUrl.replace(/\/$/, '');
    const url = new URL(upstreamPath.replace(/^\/+/, ''), `${base}/`);
    const response = await fetch(url, { method: 'GET' });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

export async function resolveLivePlayback(
  app: string,
  stream: string,
  options?: { probe?: boolean }
): Promise<ResolvedLivePlayback> {
  const safeApp = normalizeApp(app);
  const safeStream = stream.replace(/^\/+|\/+$/g, '');
  const streams = await listSrsStreams();
  const row = findSrsStream(streams, safeApp, safeStream);

  const vhost = row ? resolveStreamVhost(row) : '__defaultVhost__';
  const active = row ? row.publish?.active !== false : false;

  const upstreamHls = buildUpstreamMediaPath(safeApp, safeStream, vhost, 'm3u8');
  const upstreamFlv = buildUpstreamMediaPath(safeApp, safeStream, vhost, 'flv');

  let playable = false;
  if (active && options?.probe !== false) {
    playable = await probeUpstreamPlayable(upstreamHls);
    if (!playable) {
      playable = await probeUpstreamPlayable(upstreamFlv);
    }
  } else {
    playable = active;
  }

  const srsMediaHls = `/srs-media/${safeApp}/${safeStream}.m3u8`;
  const srsMediaFlv = `/srs-media/${safeApp}/${safeStream}.flv`;
  const protectedHls = `/api/playback/live/${safeApp}/${safeStream}.m3u8`;
  const protectedFlv = `/api/playback/live/${safeApp}/${safeStream}.flv`;

  return {
    active,
    playable,
    vhost,
    app: safeApp,
    stream: safeStream,
    upstreamHls,
    upstreamFlv,
    srsMediaHls,
    srsMediaFlv,
    protectedHls,
    protectedFlv,
  };
}

/** Upstream paths to try for a media file, resolver-first with legacy FLV fallback. */
export async function upstreamPathsForResource(
  app: string,
  stream: string,
  ext: 'm3u8' | 'flv' | 'ts'
): Promise<string[]> {
  const streams = await listSrsStreams();
  const row = findSrsStream(streams, app, stream);
  const vhost = row ? resolveStreamVhost(row) : '__defaultVhost__';
  const safeApp = normalizeApp(app);
  const safeStream = stream.replace(/^\/+|\/+$/g, '');

  const paths: string[] = [];
  paths.push(buildUpstreamMediaPath(safeApp, safeStream, vhost, ext));
  if (ext === 'flv') {
    paths.push(buildLegacyFlvPath(safeApp, safeStream, vhost));
  }
  if (row?.url?.startsWith('/')) {
    const base = row.url.replace(/\/$/, '');
    paths.push(`${base}.${ext}?vhost=${encodeURIComponent(vhost)}`);
  }
  return [...new Set(paths)];
}
