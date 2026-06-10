import React from 'react';

import type { AbrRendition, DomainBlock } from '../api/types';

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
  abrRenditions?: AbrRendition[];
}

function manifestSnapshot(manifest: EmbedPlaybackManifest): string {
  return JSON.stringify({
    active: manifest.active,
    playable: manifest.playable,
    flvPlayable: manifest.flvPlayable,
    playerHlsUrl: manifest.playerHlsUrl,
    playerFlvUrl: manifest.playerFlvUrl,
    playbackAccessPolicy: manifest.playbackAccessPolicy,
    requiresToken: manifest.requiresToken,
    token: manifest.token,
    playApp: manifest.playApp,
    playStream: manifest.playStream,
    abrRenditions: manifest.abrRenditions,
  });
}

/** Public manifest for /embed — no operator JWT. */
export function useEmbedPlaybackManifest(
  app: string,
  streamKey: string,
  options?: { enabled?: boolean; refreshMs?: number; token?: string | null }
) {
  const enabled = options?.enabled ?? true;
  const refreshMs = options?.refreshMs ?? 10000;
  const token = options?.token ?? null;
  const [manifest, setManifest] = React.useState<EmbedPlaybackManifest | null>(null);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback((background = false) => {
    if (!enabled || !app || !streamKey) {
      setLoading(false);
      return;
    }
    if (!background) {
      setLoading(true);
    }
    const params = new URLSearchParams({ app, stream: streamKey });
    if (token) {
      params.set('token', token);
    }
    fetch(`/api/playback/embed-manifest?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Manifest failed (${res.status})`);
        }
        return res.json() as Promise<EmbedPlaybackManifest>;
      })
      .then((result) => {
        setManifest((previous) => {
          if (previous && manifestSnapshot(previous) === manifestSnapshot(result)) {
            return previous;
          }
          return result;
        });
        setError(null);
      })
      .catch((err) => {
        if (!background) {
          setManifest(null);
        }
        setError(err instanceof Error ? err.message : 'Failed to load playback');
      })
      .finally(() => {
        if (!background) {
          setLoading(false);
        }
      });
  }, [app, streamKey, enabled, token]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    if (!refreshMs || !enabled) return;
    const id = window.setInterval(() => load(true), refreshMs);
    return () => window.clearInterval(id);
  }, [load, refreshMs, enabled]);

  return { manifest, loading, error, reload: load };
}
