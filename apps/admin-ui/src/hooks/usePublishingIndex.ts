import React from 'react';

import { api } from '../api/client';
import { buildPublishingIndex, type PublishingIndex } from '../lib/live-status';

const EMPTY: PublishingIndex = { inputIds: new Set(), ingestKeys: new Set() };

/** Polls live sessions and exposes which inputs are currently publishing. */
export function usePublishingIndex(refreshMs = 5000): PublishingIndex {
  const [index, setIndex] = React.useState<PublishingIndex>(EMPTY);

  const refresh = React.useCallback(async () => {
    try {
      const { items } = await api.listLiveSessions({ activeOnly: true });
      setIndex(buildPublishingIndex(items));
    } catch {
      setIndex(EMPTY);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      refresh().catch(() => undefined);
    }, refreshMs);
    return () => window.clearInterval(timer);
  }, [refresh, refreshMs]);

  return index;
}
