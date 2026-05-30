import type { Input, LiveSession } from '../api/types';

/** Match key for SRS app + stream (same as webhook / session sync). */
export function ingestKey(appName: string, streamKey: string): string {
  return `${appName.replace(/^\/+|\/+$/g, '')}/${streamKey}`;
}

export interface PublishingIndex {
  inputIds: Set<string>;
  ingestKeys: Set<string>;
}

export function buildPublishingIndex(sessions: LiveSession[]): PublishingIndex {
  const inputIds = new Set<string>();
  const ingestKeys = new Set<string>();
  for (const session of sessions) {
    if (session.status !== 'publishing') continue;
    if (session.inputId) inputIds.add(session.inputId);
    ingestKeys.add(ingestKey(session.gatewayApp ?? 'live', session.streamKey));
  }
  return { inputIds, ingestKeys };
}

export function isInputPublishing(input: Input, index: PublishingIndex): boolean {
  if (index.inputIds.has(input.id)) return true;
  const app = input.application?.appName ?? 'live';
  return index.ingestKeys.has(ingestKey(app, input.streamKey));
}

export function applicationLiveCount(
  inputs: Input[],
  index: PublishingIndex
): number {
  return inputs.filter((input) => isInputPublishing(input, index)).length;
}
