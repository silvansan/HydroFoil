import React from 'react';

import {
  RecordingPreviewModal,
  type RecordingPreviewTarget,
} from '../components/RecordingPreviewModal';

export function useRecordingPreviewModal() {
  const [target, setTarget] = React.useState<RecordingPreviewTarget | null>(null);

  const previewModal = target ? (
    <RecordingPreviewModal target={target} onClose={() => setTarget(null)} />
  ) : null;

  return {
    openRecordingPreview: (next: RecordingPreviewTarget) => setTarget(next),
    previewModal,
  };
}
