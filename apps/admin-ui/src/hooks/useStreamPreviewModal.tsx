import React from 'react';

import { StreamPreviewModal, type StreamPreviewTarget } from '../components/StreamPreviewModal';

export function useStreamPreviewModal() {
  const [target, setTarget] = React.useState<StreamPreviewTarget | null>(null);

  const previewModal = target ? (
    <StreamPreviewModal target={target} onClose={() => setTarget(null)} />
  ) : null;

  return {
    openPreview: (next: StreamPreviewTarget) => setTarget(next),
    previewModal,
  };
}
