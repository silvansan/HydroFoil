import React from 'react';

import { api, isAuthSessionExpiredError } from '../api/client';
import type { InputPlaybackShare } from '../api/types';

export type PlaybackShareOptions = {
  expiresAt?: string;
  expiresInSeconds?: number;
};

export function useInputPlaybackShare(inputId: string | undefined) {
  const [share, setShare] = React.useState<InputPlaybackShare | null>(null);
  const [loading, setLoading] = React.useState(Boolean(inputId));
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(
    (options?: PlaybackShareOptions) => {
      if (!inputId) {
        setShare(null);
        setLoading(false);
        return Promise.resolve(null);
      }
      setLoading(true);
      return api
        .getInputPlaybackUrl(inputId, options)
        .then((result) => {
          setShare(result);
          setError(null);
          return result;
        })
        .catch((err) => {
          setShare(null);
          if (!isAuthSessionExpiredError(err)) {
            setError(err instanceof Error ? err.message : 'Failed to load playback links');
          }
          return null;
        })
        .finally(() => setLoading(false));
    },
    [inputId]
  );

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { share, loading, error, reload };
}
