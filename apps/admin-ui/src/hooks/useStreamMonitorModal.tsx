import React from 'react';

import { StreamMonitorModal } from '../components/StreamMonitorModal';
import type { StreamPreviewTarget } from '../components/StreamPreviewModal';

export function useStreamMonitorModal() {
  const [target, setTarget] = React.useState<StreamPreviewTarget | null>(null);

  const monitorModal = target ? (
    <StreamMonitorModal target={target} onClose={() => setTarget(null)} />
  ) : null;

  return {
    openMonitor: (next: StreamPreviewTarget) => setTarget(next),
    monitorModal,
  };
}
