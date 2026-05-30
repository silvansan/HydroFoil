const RTMP_BASE = import.meta.env.VITE_RTMP_INGEST_URL ?? 'rtmp://localhost:1935';
const SRT_HOST = import.meta.env.VITE_SRT_INGEST_HOST ?? 'localhost';
const SRT_PORT = Number(import.meta.env.VITE_SRT_INGEST_PORT ?? 10080);

export function generateStreamKey(name?: string): string {
  const slug = (name ?? 'stream')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 8);
  return slug ? `${slug}-${suffix}` : suffix;
}

export function rtmpIngestUrl(streamKey: string, app = 'live'): string {
  const base = RTMP_BASE.replace(/\/$/, '');
  return `${base}/${app}/${streamKey}`;
}

export function srtIngestUrl(streamKey: string, app = 'live'): string {
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = streamKey.replace(/^\/+|\/+$/g, '');
  const streamid = `#!::r=${safeApp}/${safeStream},m=publish`;
  const hostPart = SRT_HOST.includes(':') ? `[${SRT_HOST}]` : SRT_HOST;
  return `srt://${hostPart}:${SRT_PORT}?streamid=${encodeURIComponent(streamid)}`;
}

export function suggestPlaybackTarget(
  protocol: string,
  app: string,
  stream: string
): string {
  const safeApp = app || 'live';
  const safeStream = stream || '{stream}';
  switch (protocol) {
    case 'hls':
      return `http://localhost:8080/${safeApp}/${safeStream}.m3u8`;
    case 'http-flv':
      return `http://localhost:8080/${safeApp}/${safeStream}.flv`;
    case 'rtmp':
      return `rtmp://localhost:1935/${safeApp}/${safeStream}`;
    default:
      return `/${safeApp}/${safeStream}`;
  }
}
