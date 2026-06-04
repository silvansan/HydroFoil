import { buildRtmpPlayUrl } from './rtmp-playback';

/** Canonical HLS path stored on watch outputs (restream / web embed). */
export function buildHlsRouteTarget(appName: string, streamKey: string): string {
  const base = (process.env.SRS_PLAYBACK_HTTP_BASE ?? 'http://localhost:8080').replace(/\/$/, '');
  const app = appName.replace(/^\/+|\/+$/g, '') || 'live';
  const stream = streamKey.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}.m3u8`;
}

export function watchOutputName(appName: string, streamKey: string): string {
  const app = appName.replace(/^\/+|\/+$/g, '') || 'live';
  return `Watch: ${app}/${streamKey}`;
}

export function watchRouteName(appName: string, streamKey: string): string {
  return watchOutputName(appName, streamKey);
}

/** RTMP play URL for operator monitor (VLC / vMix preview). */
export function buildRtmpRouteTarget(appName: string, streamKey: string): string {
  return buildRtmpPlayUrl(appName, streamKey);
}
