import type { RecordingAsset } from '../api/types';

export type RecordingStatusFilter = 'all' | 'ready' | 'finalizing' | 'recording' | 'failed';

export function formatRecordingDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
}

export function formatRecordingBytes(size: number): string {
  if (!size || size <= 0) return '—';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function describeRecordingStatus(status: string): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'active';
  hint?: string;
} {
  switch (status) {
    case 'ready':
      return { label: 'Ready', tone: 'success', hint: 'Playable and downloadable' };
    case 'finalizing':
      return {
        label: 'Finalizing',
        tone: 'warning',
        hint: 'Uploading to storage — refresh in a moment',
      };
    case 'recording':
      return { label: 'Recording', tone: 'active', hint: 'Live DVR in progress' };
    case 'failed':
      return { label: 'Failed', tone: 'danger', hint: 'Finalize or upload did not complete' };
    default:
      return { label: status || 'Unknown', tone: 'neutral' };
  }
}

export function describePlaybackFormats(recording: Pick<
  RecordingAsset,
  'playbackFormats' | 'finalizedContainer' | 'hasHls'
>): string {
  const formats = recording.playbackFormats ?? [];
  if (formats.length === 0) {
    if (recording.hasHls) return 'HLS + FLV';
    if (recording.finalizedContainer === 'mp4') return 'MP4';
    return 'FLV';
  }
  return formats.map((f) => f.toUpperCase()).join(' · ');
}

export function recordingStatusCounts(items: RecordingAsset[]) {
  return {
    all: items.length,
    ready: items.filter((r) => r.status === 'ready').length,
    finalizing: items.filter((r) => r.status === 'finalizing').length,
    recording: items.filter((r) => r.status === 'recording').length,
    failed: items.filter((r) => r.status === 'failed').length,
  };
}

export function filterRecordings(
  items: RecordingAsset[],
  options: { search: string; status: RecordingStatusFilter }
): RecordingAsset[] {
  const q = options.search.trim().toLowerCase();
  return items.filter((recording) => {
    if (options.status !== 'all' && recording.status !== options.status) {
      return false;
    }
    if (!q) return true;
    const haystack = [
      recording.applicationName,
      recording.inputName,
      recording.streamKey,
      recording.recordingPolicyName,
      recording.objectKey,
      recording.recordingPath,
      recording.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function formatRecordingTimestamp(value?: string | Date): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}
