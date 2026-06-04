import { config } from '../config';

/** Public RTMP play URL (VLC, vMix, OBS preview) — same path as publish while stream is live. */
export function buildRtmpPlayUrl(appName: string, streamKey: string): string {
  const base = config.srsRtmpForwardBase.replace(/\/$/, '');
  const app = appName.replace(/^\/+|\/+$/g, '') || 'live';
  const stream = streamKey.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}`;
}
