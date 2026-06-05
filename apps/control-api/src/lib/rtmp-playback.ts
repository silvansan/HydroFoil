import { config } from '../config';

/** Public RTMPS/RTMP play URL from SRS_RTMP_FORWARD_BASE — same path as publish while live. */
export function buildRtmpPlayUrl(appName: string, streamKey: string): string {
  const base = config.srsRtmpForwardBase.replace(/\/$/, '');
  const app = appName.replace(/^\/+|\/+$/g, '') || 'live';
  const stream = streamKey.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}`;
}
