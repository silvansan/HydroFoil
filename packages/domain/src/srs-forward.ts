import type { SRSForwardConfig, SRSIngestConfig, SRSDesiredConfig } from './services';
import { isExternalPushTarget, isSrtPushTarget } from './restream';

/** SRS forward URL — external RTMP uses route_target as-is. */
export function resolveForwardRtmpUrl(
  forward: Pick<SRSForwardConfig, 'app' | 'stream' | 'routeTarget'>,
  rtmpBase: string
): string {
  const target = forward.routeTarget.trim();
  if (isExternalPushTarget(target)) {
    return target;
  }
  return buildForwardRtmpUrl(forward, rtmpBase);
}

/** RTMP URL for SRS dynamic forward (same instance, different app/stream). */
export function buildForwardRtmpUrl(
  forward: Pick<SRSForwardConfig, 'app' | 'stream'>,
  rtmpBase: string
): string {
  const base = rtmpBase.replace(/\/$/, '');
  const app = forward.app.replace(/^\/+|\/+$/g, '');
  const stream = forward.stream.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}`;
}

export function filterForwardsForPublish(
  forwards: SRSForwardConfig[],
  source: { app: string; stream: string }
): SRSForwardConfig[] {
  const sourceApp = source.app.replace(/^\/+|\/+$/g, '');
  const sourceStream = source.stream.replace(/^\/+|\/+$/g, '');
  return forwards.filter((forward) => {
    const app = forward.app.replace(/^\/+|\/+$/g, '');
    const stream = forward.stream.replace(/^\/+|\/+$/g, '');
    return app !== sourceApp || stream !== sourceStream;
  });
}

export function buildForwardRtmpUrls(
  forwards: SRSForwardConfig[],
  rtmpBase: string,
  source?: { app: string; stream: string }
): string[] {
  const list = source ? filterForwardsForPublish(forwards, source) : forwards;
  return list
    .filter((forward) => !isSrtPushTarget(forward.routeTarget))
    .map((forward) => resolveForwardRtmpUrl(forward, rtmpBase));
}

export function findIngestByStreamKey(
  config: SRSDesiredConfig,
  streamKey: string
): SRSIngestConfig | undefined {
  return config.ingests.find((ingest) => ingest.streamKey === streamKey && ingest.enabled);
}

export function findIngestByAppAndStreamKey(
  config: SRSDesiredConfig,
  app: string,
  streamKey: string
): SRSIngestConfig | undefined {
  const normalizedApp = app.replace(/^\/+|\/+$/g, '');
  return config.ingests.find(
    (ingest) =>
      ingest.enabled &&
      ingest.streamKey === streamKey &&
      ingest.app.replace(/^\/+|\/+$/g, '') === normalizedApp
  );
}
