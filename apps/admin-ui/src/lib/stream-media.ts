import type { Input, RestreamDestination } from '../api/types';
import { absoluteHlsUrl, buildHlsEmbedCode, buildLiveIframeEmbedCode } from './playback';

export interface StreamMediaTarget {
  streamKey: string;
  gatewayApp: string;
  label?: string;
  status?: string;
  /** Signed or public VOD URL when live HLS is not applicable (recordings). */
  playbackUrl?: string;
}

export function canPreviewHls(target: StreamMediaTarget): boolean {
  if (target.playbackUrl) return true;
  return Boolean(target.streamKey && target.gatewayApp);
}

export function hlsUrlForTarget(target: StreamMediaTarget): string {
  if (target.playbackUrl) return target.playbackUrl;
  return absoluteHlsUrl(target.streamKey, target.gatewayApp);
}

export function embedCodeForTarget(target: StreamMediaTarget): string {
  if (target.playbackUrl) {
    return buildHlsEmbedCode(target.playbackUrl);
  }
  return buildLiveIframeEmbedCode(target.streamKey, target.gatewayApp);
}

/** HLS preview target for a restream row (source ingest or local mirror path). */
export function streamMediaTargetForRestreamRow(
  input: Input,
  dest: RestreamDestination
): StreamMediaTarget {
  const appName = input.application?.appName ?? 'live';
  if (dest.kind === 'local_mirror' && dest.gatewayApp && dest.gatewayStream) {
    return {
      streamKey: dest.gatewayStream,
      gatewayApp: dest.gatewayApp,
      label: `${input.name} → ${dest.name}`,
    };
  }
  return {
    streamKey: input.streamKey,
    gatewayApp: appName,
    label: `${input.name} → ${dest.name}`,
  };
}