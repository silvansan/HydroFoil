import { config } from '../config';

function hostFromUrl(base: string): string | undefined {
  try {
    const host = new URL(base).hostname;
    return host && host !== '127.0.0.1' && host !== 'localhost' ? host : undefined;
  } catch {
    return undefined;
  }
}

/** Values shown in the admin UI for copy-to-clipboard ingest URLs. */
export function getOperatorPublicUrls() {
  const rtmpIngestBase = config.srsRtmpForwardBase.replace(/\/$/, '');
  const srtIngestHost =
    config.srsSrtPublicHost.trim() ||
    hostFromUrl(config.publicAppUrl) ||
    hostFromUrl(rtmpIngestBase) ||
    'localhost';

  return {
    rtmpIngestBase,
    srtIngestHost,
    srtIngestPort: config.srsSrtPublicPort,
    publicAppUrl: config.publicAppUrl,
  };
}
