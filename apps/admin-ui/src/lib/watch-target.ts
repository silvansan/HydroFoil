import type { Input, Output } from '../api/types';

export interface WatchTarget {
  gatewayApp: string;
  streamKey: string;
  label: string;
}

export function inputWatchTarget(input: Input): WatchTarget {
  const gatewayApp = input.application?.appName ?? 'live';
  return {
    gatewayApp,
    streamKey: input.streamKey,
    label: `Watch ${input.name}`,
  };
}

/** HLS outputs can be previewed via the SRS proxy path. */
export function outputWatchTarget(output: Output): WatchTarget | null {
  if (output.playbackProtocol !== 'hls') return null;
  return {
    gatewayApp: output.gatewayAppName,
    streamKey: output.gatewayStreamName,
    label: `Watch ${output.name}`,
  };
}
