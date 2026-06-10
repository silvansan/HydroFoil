import React from 'react';

import { api } from '../api/client';
import type { LivePlaybackResolve } from '../api/types';
import { absoluteApiUrl } from '../lib/playback';

export function useLivePlaybackResolve(
  app: string,
  streamKey: string,
  options?: { enabled?: boolean; refreshMs?: number }
) {
  const enabled = options?.enabled ?? true;
  const refreshMs = options?.refreshMs ?? 0;
  const [resolved, setResolved] = React.useState<LivePlaybackResolve | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!enabled || !app || !streamKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .resolveLivePlayback({ app, stream: streamKey })
      .then((result) => {
        setResolved(result);
        setError(null);
      })
      .catch((err) => {
        setResolved(null);
        setError(err instanceof Error ? err.message : 'Failed to resolve playback');
      })
      .finally(() => setLoading(false));
  }, [app, streamKey, enabled]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!refreshMs || !enabled) return;
    const id = window.setInterval(load, refreshMs);
    return () => window.clearInterval(id);
  }, [load, refreshMs, enabled]);

  const monitorFlvUrl = resolved?.monitorFlvUrl
    ? absoluteApiUrl(resolved.monitorFlvUrl)
    : null;
  const playerHlsUrl = resolved?.playerHlsUrl
    ? absoluteApiUrl(resolved.playerHlsUrl)
    : null;

  return {
    resolved,
    loading,
    error,
    monitorFlvUrl,
    playerHlsUrl,
    vhost: resolved?.vhost ?? null,
    playable: Boolean(resolved?.playable),
    active: Boolean(resolved?.active),
    hlsPlayable: Boolean(resolved?.hlsPlayable),
    abrRenditions: resolved?.abrRenditions ?? [],
    reload: load,
  };
}
