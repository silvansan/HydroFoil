import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card } from '@hydrofoil/ui-kit';
import { Copy, Download, RefreshCw } from 'lucide-react';

import { api } from '../api/client';
import type { RecordingAsset, RecordingPlaybackInfo } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { RecordingStatusBadge } from '../components/RecordingStatusBadge';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { copyText } from '../lib/clipboard';
import { useRecordingPreviewModal } from '../hooks/useRecordingPreviewModal';
import {
  describePlaybackFormats,
  formatRecordingBytes,
  formatRecordingDuration,
  formatRecordingTimestamp,
} from '../lib/recording-management';

const RecordingSettingsPage: React.FC = () => {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const { openRecordingPreview, previewModal } = useRecordingPreviewModal();
  const [recording, setRecording] = React.useState<RecordingAsset | null>(null);
  const [playback, setPlayback] = React.useState<RecordingPlaybackInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!recordingId) return;
    setError(null);
    try {
      const asset = await api.getRecording(recordingId);
      setRecording(asset);
      if (asset.status === 'ready') {
        const playbackInfo = await api.getRecordingPlaybackUrl(recordingId);
        setPlayback(playbackInfo);
      } else {
        setPlayback(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recording');
    }
  }, [recordingId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!recording || recording.status !== 'finalizing') return;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [recording?.status, recording?.id, load]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const playable = recording?.status === 'ready';

  const copyObjectKey = async () => {
    if (!recording?.objectKey) return;
    const ok = await copyText(recording.objectKey);
    notify(ok ? 'Object key copied' : 'Copy failed');
  };

  const download = async () => {
    if (!recordingId || !playable) return;
    try {
      const info = playback ?? (await api.getRecordingPlaybackUrl(recordingId));
      window.open(info.shareUrl || info.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to get download link');
    }
  };

  if (!recording && !error) {
    return <div className="hf-muted py-12 text-center">Loading recording…</div>;
  }

  return (
    <ResourceSettingsLayout
      backTo="/recordings"
      backLabel="All recordings"
      title={recording?.inputName ?? 'Recording'}
      description={
        recording ? (
          <span className="font-mono text-sm">
            {recording.applicationName ?? '—'} / {recording.streamKey ?? recording.objectKey}
          </span>
        ) : undefined
      }
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} className="mr-1 inline" aria-hidden />
            Refresh
          </Button>
          {recording && playable ? (
            <StreamMediaActions
              target={{
                streamKey: recording.streamKey ?? recording.objectKey,
                gatewayApp: '',
                label: recording.inputName ?? recording.objectKey,
              }}
              allowPreviewWithoutHls
              showShare={false}
              onPreview={() => {
                if (!recordingId) return;
                openRecordingPreview({
                  id: recordingId,
                  label: recording.inputName ?? recording.streamKey ?? recording.objectKey,
                });
              }}
              onNotify={notify}
            />
          ) : null}
        </div>
      }
    >
      {error && <Alert>{error}</Alert>}
      {toast && <Alert variant="info">{toast}</Alert>}
      {previewModal}

      {recording && (
        <div className="space-y-6 max-w-3xl">
          <Card className="p-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <RecordingStatusBadge status={recording.status} showHint />
              {playable && (
                <p className="text-sm hf-muted">
                  Playback: {describePlaybackFormats(recording)}
                  {playback?.format ? ` (default ${playback.format.toUpperCase()})` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {playable && (
                <>
                  <Button variant="primary" size="sm" onClick={() => recordingId && openRecordingPreview({
                    id: recordingId,
                    label: recording.inputName ?? recording.objectKey,
                  })}>
                    Preview
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void download()}>
                    <Download size={14} className="mr-1 inline" aria-hidden />
                    Download
                  </Button>
                </>
              )}
              <DeleteButton
                label="Delete"
                confirmTitle="Delete recording?"
                confirmMessage={`Remove "${recording.objectKey}" from the catalog and delete media from storage?`}
                onDelete={async () => {
                  await api.deleteRecording(recordingId!);
                  navigate('/recordings', { replace: true });
                }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-100 mb-4">Details</h2>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="hf-muted">Object key</dt>
                <dd className="mt-1 font-mono text-slate-200 break-all flex items-start gap-2">
                  <span className="flex-1">{recording.objectKey}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-slate-400 hover:text-brand-300"
                    title="Copy object key"
                    onClick={() => void copyObjectKey()}
                  >
                    <Copy size={14} />
                  </button>
                </dd>
              </div>
              <div>
                <dt className="hf-muted">Recording policy</dt>
                <dd className="mt-1 text-slate-200">
                  {recording.recordingPolicyId && recording.recordingPolicyName ? (
                    <Link
                      to={`/recording-policies/${recording.recordingPolicyId}`}
                      className="hf-link hover:underline"
                    >
                      {recording.recordingPolicyName}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="hf-muted">Duration</dt>
                <dd className="mt-1 text-slate-200">
                  {formatRecordingDuration(Number(recording.duration))}
                </dd>
              </div>
              <div>
                <dt className="hf-muted">File size</dt>
                <dd className="mt-1 text-slate-200">
                  {formatRecordingBytes(Number(recording.fileSize))}
                </dd>
              </div>
              <div>
                <dt className="hf-muted">Started</dt>
                <dd className="mt-1 text-slate-200">
                  {formatRecordingTimestamp(recording.startedAt)}
                </dd>
              </div>
              <div>
                <dt className="hf-muted">Finished</dt>
                <dd className="mt-1 text-slate-200">
                  {formatRecordingTimestamp(recording.finishedAt)}
                </dd>
              </div>
            </dl>
          </Card>

          {playback && (playback.audioAssets?.length ?? 0) > 0 && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-slate-100 mb-2">Audio derivatives</h2>
              <p className="text-sm hf-muted mb-4">
                Generated from this recording via audio feed profiles.
              </p>
              <ul className="space-y-2">
                {playback.audioAssets.map((asset) => (
                  <li
                    key={asset.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-200 uppercase">{asset.codec}</span>
                    <span className="hf-muted">
                      {formatRecordingDuration(asset.duration)} ·{' '}
                      {formatRecordingBytes(asset.fileSize)}
                    </span>
                    <a
                      href={asset.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hf-link hover:underline"
                    >
                      Open audio
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-100 mb-3">Related</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {recording.inputId && (
                <Link to={`/stream-keys/${recording.inputId}`} className="hf-link hover:underline">
                  Stream key settings
                </Link>
              )}
              {recording.liveSessionId && (
                <Link
                  to={`/live-sessions/${recording.liveSessionId}`}
                  className="hf-link hover:underline"
                >
                  Live session
                </Link>
              )}
              {recording.applicationId && (
                <Link
                  to={`/inputs/applications/${recording.applicationId}`}
                  className="hf-link hover:underline"
                >
                  Application
                </Link>
              )}
            </div>
          </Card>
        </div>
      )}
    </ResourceSettingsLayout>
  );
};

export default RecordingSettingsPage;
