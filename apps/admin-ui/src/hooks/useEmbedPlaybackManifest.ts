import React from 'react';

import type { DomainBlock } from '../api/types';

export interface EmbedPlaybackManifest {
  active: boolean;
  playable: boolean;
  flvPlayable?: boolean;
  app: string;
  stream: string;
  playApp?: string;
  playStream?: string;
  playerHlsUrl: string;
  playerFlvUrl?: string;
  embedUrl: string;
  playbackAccessPolicy: DomainBlock['playbackAccessPolicy'];
  requiresToken: boolean;
  token?: string;
  expiresAt?: string;
}

/** Public manifest for /embed — no operator JWT. */
export function useEmbedPlaybackManifest(
  app: string,
  streamKey: string,
  options?: { enabled?: boolean; refreshMs?: number }
) {
  const enabled = options?.enabled ?? true;
  const refreshMs = options?.refreshMs ?? 10000;
  const [manifest, setManifest] = React.useState<EmbedPlaybackManifest | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!enabled || !app || !streamKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ app, stream: streamKey });
    fetch(`/api/playback/embed-manifest?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Manifest failed (${res.status})`);
        }
        return res.json() as Promise<EmbedPlaybackManifest>;
      })
      .then((result) => {
        setManifest(result);
        setError(null);
      })
      .catch((err) => {
        setManifest(null);
        setError(err instanceof Error ? err.message : 'Failed to load playback');
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

  return { manifest, loading, error, reload: load };
}
