import { config } from '../config';
import { buildRtmpPlayUrl } from '../lib/rtmp-playback';

export interface SrsStreamRow {
  name?: string;
  app?: string;
  vhost?: string;
  url?: string;
  publish?: { active?: boolean; vhost?: string };
}

export interface ResolvedLivePlayback {
  active: boolean;
  /** True when SRS reports an active publisher (RTMP monitor ready). */
  playable: boolean;
  monitorMode: 'rtmp' | 'http';
  vhost: string;
  app: string;
  stream: string;
  rtmpPublishUrl: string;
  rtmpPlayUrl: string;
  upstreamHls: string;
  upstreamFlv: string;
  srsMediaHls: string;
  srsMediaFlv: string;
  protectedHls: string;
  protectedFlv: string;
}

export function normalizeApp(app: string) {
  return app.replace(/^\/+|\/+$/g, '') || 'live';
}

const KNOWN_VHOSTS = new Set(['localhost', '__defaultVhost__']);

function isPlausibleSrsVhost(value: string | undefined): value is string {
  if (!value || value.length > 120) return false;
  if (value.startsWith('vid-') || value.includes('/')) return false;
  return true;
}

export function resolveStreamVhost(row: SrsStreamRow): string {
  const candidates = [row.publish?.vhost, row.vhost].filter(isPlausibleSrsVhost);
  for (const candidate of candidates) {
    if (KNOWN_VHOSTS.has(candidate) || candidate.includes('.')) {
      return candidate;
    }
  }
  return candidates[0] ?? '__defaultVhost__';
}

/** Operator-facing playback path — vhost is implied by the site hostname (nginx injects ?vhost= to SRS). */
export function buildPublicMediaPath(
  app: string,
  stream: string,
  ext: 'm3u8' | 'flv' | 'ts'
): string {
  const safeApp = normalizeApp(app);
  const safeStream = stream.replace(/^\/+|\/+$/g, '');
  return `/${safeApp}/${safeStream}.${ext}`;
}

/** Default ingest vhost when SRS has no active stream row (new deploy / any domain). */
export function resolveDefaultIngestVhost(): string {
  const configured = config.srsIngestVhost;
  if (configured && configured !== 'localhost') {
    return configured;
  }
  try {
    const host = new URL(config.publicAppUrl).hostname;
    if (host) return host;
  } catch {
    // ignore
  }
  return '__defaultVhost__';
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
  options?: { probe?: boolean; monitorMode?: 'rtmp' | 'http' }
): Promise<ResolvedLivePlayback> {
  const safeApp = normalizeApp(app);
  const safeStream = stream.replace(/^\/+|\/+$/g, '');
  const monitorMode = options?.monitorMode ?? 'rtmp';
  const streams = await listSrsStreams();
  const row = findSrsStream(streams, safeApp, safeStream);

  const vhost = row ? resolveStreamVhost(row) : resolveDefaultIngestVhost();
  const active = row ? row.publish?.active !== false : false;

  const upstreamHls = buildUpstreamMediaPath(safeApp, safeStream, vhost, 'm3u8');
  const upstreamFlv = buildUpstreamMediaPath(safeApp, safeStream, vhost, 'flv');
  const rtmpPlayUrl = buildRtmpPlayUrl(safeApp, safeStream);

  let playable = active;
  if (active && monitorMode === 'http' && options?.probe !== false) {
    playable = await probeUpstreamPlayable(upstreamFlv);
    if (!playable) {
      playable = await probeUpstreamPlayable(upstreamHls);
    }
  }

  const srsMediaHls = buildPublicMediaPath(safeApp, safeStream, 'm3u8');
  const srsMediaFlv = buildPublicMediaPath(safeApp, safeStream, 'flv');
  const protectedHls = `/api/playback/live/${safeApp}/${safeStream}.m3u8`;
  const protectedFlv = `/api/playback/live/${safeApp}/${safeStream}.flv`;

  return {
    active,
    playable,
    monitorMode,
    vhost,
    app: safeApp,
    stream: safeStream,
    rtmpPublishUrl: rtmpPlayUrl,
    rtmpPlayUrl,
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
  const vhost = row ? resolveStreamVhost(row) : resolveDefaultIngestVhost();
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
