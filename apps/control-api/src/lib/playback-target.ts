/** Canonical HLS path stored on auto-created watch outputs. */
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
