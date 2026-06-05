import { absoluteApiUrl } from './playback';

/** FLV URLs to try for in-browser RTMP ingest monitor (SRS mount + proxy fallbacks). */
export function monitorFlvCandidates(
  streamKey: string,
  gatewayApp: string,
  options?: { primary?: string | null; vhost?: string | null }
): string[] {
  const vhost = options?.vhost?.trim() || '__defaultVhost__';
  const q = `?vhost=${encodeURIComponent(vhost)}`;
  const paths = [
    options?.primary,
    `/srs-media/${gatewayApp}/${streamKey}.flv`,
    `/${gatewayApp}/${streamKey}.flv${q}`,
    `/${vhost}/${gatewayApp}/${streamKey}.flv${q}`,
  ].filter((p): p is string => Boolean(p));

  return [...new Set(paths.map((p) => (p.startsWith('http') ? p : absoluteApiUrl(p))))];
}
