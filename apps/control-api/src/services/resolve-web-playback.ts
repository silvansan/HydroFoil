import type { Input, Output } from '@hydrofoil/shared-types';

import {
  findSrsStream,
  listSrsStreams,
  normalizeApp,
  probeUpstreamPlayable,
  resolveLivePlayback,
} from './playback-resolver';

export interface ResolvedWebPlaybackTarget {
  app: string;
  stream: string;
  active: boolean;
  hlsPlayable: boolean;
}

function uniqueTargets(targets: Array<{ app: string; stream: string }>): Array<{ app: string; stream: string }> {
  const seen = new Set<string>();
  const result: Array<{ app: string; stream: string }> = [];
  for (const target of targets) {
    const app = normalizeApp(target.app);
    const stream = target.stream.replace(/^\/+|\/+$/g, '');
    if (!app || !stream) continue;
    const key = `${app}/${stream}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ app, stream });
  }
  return result;
}

async function srsSiblingTargets(app: string, streamKey: string): Promise<Array<{ app: string; stream: string }>> {
  const streams = await listSrsStreams();
  const safeApp = normalizeApp(app);
  const prefix = streamKey.replace(/^\/+|\/+$/g, '');
  return streams
    .filter((row) => {
      const rowApp = normalizeApp(row.app ?? 'live');
      const name = row.name ?? '';
      return rowApp === safeApp && name.startsWith(prefix) && name.length >= prefix.length;
    })
    .map((row) => ({ app: safeApp, stream: row.name ?? prefix }));
}

/** Find an SRS path that actually serves HLS (ingest, linked outputs, or live transcode siblings). */
export async function resolvePlayableWebHlsTarget(options: {
  defaultApp: string;
  input: Pick<Input, 'streamKey'>;
  linkedOutputs: Output[];
}): Promise<ResolvedWebPlaybackTarget> {
  const ingestApp = normalizeApp(options.defaultApp);
  const ingestStream = options.input.streamKey.replace(/^\/+|\/+$/g, '');

  const outputTargets = options.linkedOutputs
    .filter((output) => output.enabled)
    .sort((a, b) => {
      const score = (output: Output) => {
        if (output.playbackProtocol === 'hls') return 0;
        if (output.name.startsWith('HLS:')) return 1;
        return 2;
      };
      return score(a) - score(b);
    })
    .map((output) => ({
      app: output.gatewayAppName,
      stream: output.gatewayStreamName,
    }));

  const siblingTargets = await srsSiblingTargets(ingestApp, ingestStream);
  const candidates = uniqueTargets([
    { app: ingestApp, stream: ingestStream },
    ...outputTargets,
    ...siblingTargets,
  ]);

  let anyActive = false;

  for (const candidate of candidates) {
    const resolved = await resolveLivePlayback(candidate.app, candidate.stream, {
      probe: true,
      monitorMode: 'http',
    });
    if (resolved.active) anyActive = true;
    if (resolved.playable) {
      return {
        app: candidate.app,
        stream: candidate.stream,
        active: resolved.active,
        hlsPlayable: true,
      };
    }
    if (await probeUpstreamPlayable(resolved.upstreamHls)) {
      return {
        app: candidate.app,
        stream: candidate.stream,
        active: resolved.active || anyActive,
        hlsPlayable: true,
      };
    }
  }

  const fallback = await resolveLivePlayback(ingestApp, ingestStream, { probe: false });
  const row = findSrsStream(await listSrsStreams(), ingestApp, ingestStream);

  return {
    app: ingestApp,
    stream: ingestStream,
    active: fallback.active || Boolean(row?.publish?.active !== false),
    hlsPlayable: false,
  };
}
