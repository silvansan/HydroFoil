export const WATCH_OUTPUT_PREFIX = 'Watch:';

export function isWatchOutputName(name: string): boolean {
  return name.startsWith(WATCH_OUTPUT_PREFIX);
}

export function isExternalPushTarget(routeTarget: string): boolean {
  return /^rtmps?:\/\//i.test(routeTarget.trim());
}

export function isSrtPushTarget(routeTarget: string): boolean {
  return /^srt:\/\//i.test(routeTarget.trim());
}

/** SRS SRT publish streamid — maps to RTMP app/stream. */
export function buildSrtPublishStreamId(app: string, streamKey: string): string {
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = streamKey.replace(/^\/+|\/+$/g, '');
  return `#!::r=${safeApp}/${safeStream},m=publish`;
}

export interface SrtPushUrlOptions {
  streamId?: string;
  passphrase?: string;
  latency?: number;
}

/** Append SRT query params (streamid, passphrase, latency) to a base srt:// URL. */
export function buildSrtPushUrl(baseUrl: string, options?: SrtPushUrlOptions): string {
  const trimmed = baseUrl.trim();
  if (!options) return trimmed;

  const params = new URLSearchParams();
  if (options.streamId?.trim()) params.set('streamid', options.streamId.trim());
  if (options.passphrase?.trim()) params.set('passphrase', options.passphrase.trim());
  if (options.latency != null && options.latency >= 0) {
    params.set('latency', String(Math.round(options.latency)));
  }

  const qs = params.toString();
  if (!qs) return trimmed;
  const sep = trimmed.includes('?') ? '&' : '?';
  return `${trimmed}${sep}${qs}`;
}

/** Encoder ingest URL for publishing into SRS via SRT. */
export function buildSrtIngestUrl(
  streamKey: string,
  app = 'live',
  host = 'localhost',
  port = 10080
): string {
  const streamid = buildSrtPublishStreamId(app, streamKey);
  const hostPart = host.includes(':') ? `[${host}]` : host;
  return `srt://${hostPart}:${port}?streamid=${encodeURIComponent(streamid)}`;
}
