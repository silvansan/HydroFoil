import React from 'react';

import { api } from '../api/client';
import type { InputPlaybackShare } from '../api/types';

export function useInputPlaybackShare(inputId: string | undefined) {
  const [share, setShare] = React.useState<InputPlaybackShare | null>(null);
  const [loading, setLoading] = React.useState(Boolean(inputId));
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(() => {
    if (!inputId) {
      setShare(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getInputPlaybackUrl(inputId)
      .then((result) => {
        setShare(result);
        setError(null);
      })
      .catch((err) => {
        setShare(null);
        setError(err instanceof Error ? err.message : 'Failed to load playback links');
      })
      .finally(() => setLoading(false));
  }, [inputId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { share, loading, error, reload };
}
