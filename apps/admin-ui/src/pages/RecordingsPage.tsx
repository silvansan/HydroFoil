import React from 'react';
import { PageHeader, Card } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useResourceList } from '../hooks/useResourceList';
import { useRecordingPreviewModal } from '../hooks/useRecordingPreviewModal';

type RecordingRow = {
  id: string;
  objectKey: string;
  status: string;
  duration: number;
  fileSize: number;
};

const RecordingsPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<RecordingRow>(() =>
    api.listRecordings()
  );
  const { openRecordingPreview, previewModal } = useRecordingPreviewModal();
  const [toast, setToast] = React.useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Recordings"
        description="Finalized DVR and media assets — click a row for details"
      />

      {error && <Alert>{error}</Alert>}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      {previewModal}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Recording assets</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading recordings…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            No recordings yet. Assets are registered after sessions finalize.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Object key</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Size</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((recording) => {
                  const sizeMb =
                    recording.fileSize > 0
                      ? `${Math.round(Number(recording.fileSize) / 1024 / 1024)} MB`
                      : '—';
                  const playable = recording.status === 'ready';
                  const target = {
                    streamKey: recording.objectKey,
                    gatewayApp: '',
                    label: recording.objectKey,
                  };
                  return (
                    <ClickableRow key={recording.id} to={`/recordings/${recording.id}`}>
                      <td className="px-4 py-3 text-sm font-mono text-slate-300 max-w-md truncate">
                        <span title={recording.objectKey}>{recording.objectKey}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{recording.status}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{recording.duration}s</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{sizeMb}</td>
                      <RowActionsCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <StreamMediaActions
                            target={target}
                            allowPreviewWithoutHls={playable}
                            showShare={false}
                            onPreview={() => {
                              if (!playable) {
                                notify(
                                  recording.status === 'finalizing'
                                    ? 'Recording is still uploading to storage…'
                                    : 'Recording is not ready for playback yet.'
                                );
                                return;
                              }
                              openRecordingPreview({
                                id: recording.id,
                                label: recording.objectKey,
                              });
                            }}
                            onNotify={notify}
                          />
                          <DeleteButton
                            label="Delete recording"
                            confirmTitle="Delete recording?"
                            confirmMessage={`Remove "${recording.objectKey}" from the catalog and delete the file from storage?`}
                            onDelete={async () => {
                              await api.deleteRecording(recording.id);
                              await reload();
                            }}
                          />
                        </div>
                      </RowActionsCell>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RecordingsPage;
