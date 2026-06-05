import type { StreamPreviewTarget } from '../components/StreamPreviewModal';

/** Open the WebRTC-first play modal for a live ingest row. */
export function openLivePlayModal(
  openMonitor: (target: StreamPreviewTarget) => void,
  target: Omit<StreamPreviewTarget, 'status'> & { status?: string }
): void {
  openMonitor({
    ...target,
    status: target.status ?? 'publishing',
  });
}
