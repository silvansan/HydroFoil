import React from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import { Card } from '@hydrofoil/ui-kit';



import { api } from '../api/client';
import type { RecordingAsset } from '../api/types';

import { Alert } from '../components/Alert';

import { DeleteButton } from '../components/DeleteButton';

import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';

import { StreamMediaActions } from '../components/StreamMediaActions';

import { useRecordingPreviewModal } from '../hooks/useRecordingPreviewModal';



const RecordingSettingsPage: React.FC = () => {

  const { recordingId } = useParams<{ recordingId: string }>();

  const navigate = useNavigate();

  const { openRecordingPreview, previewModal } = useRecordingPreviewModal();

  const [recording, setRecording] = React.useState<RecordingAsset | null>(null);

  const [error, setError] = React.useState<string | null>(null);

  const [toast, setToast] = React.useState<string | null>(null);



  React.useEffect(() => {

    if (!recordingId) return;

    api

      .getRecording(recordingId)

      .then(setRecording)

      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));

  }, [recordingId]);



  const objectKey = String(recording?.objectKey ?? '');

  const status = String(recording?.status ?? '');

  const playable = status === 'ready';

  const sizeMb = recording?.fileSize

    ? `${Math.round(Number(recording.fileSize) / 1024 / 1024)} MB`

    : '—';



  const notify = (message: string) => {

    setToast(message);

    window.setTimeout(() => setToast(null), 2000);

  };



  return (

    <ResourceSettingsLayout

      backTo="/recordings"

      backLabel="All recordings"

      title="Recording"

      description={<span className="font-mono text-sm">{objectKey || '…'}</span>}

      action={

        recording ? (

          <StreamMediaActions

            target={{ streamKey: objectKey, gatewayApp: '', label: objectKey }}

            allowPreviewWithoutHls={playable}

            showShare={false}

            onPreview={() => {

              if (!playable || !recordingId) {

                notify(

                  status === 'finalizing'

                    ? 'Recording is still uploading to storage…'

                    : 'Recording is not ready for playback yet.'

                );

                return;

              }

              openRecordingPreview({ id: recordingId, label: objectKey });

            }}

            onNotify={notify}

          />

        ) : undefined

      }

    >

      {error && <Alert>{error}</Alert>}

      {toast && (

        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">

          {toast}

        </div>

      )}

      {previewModal}

      {recording && (

        <Card className="p-6 space-y-4 max-w-xl">

          <dl className="grid gap-3 text-sm">

            <div>

              <dt className="hf-muted">Object key</dt>

              <dd className="font-mono text-slate-200 break-all">{objectKey}</dd>

            </div>

            <div>

              <dt className="hf-muted">Status</dt>

              <dd className="text-slate-200">{status || '—'}</dd>

            </div>

            <div>

              <dt className="hf-muted">Duration</dt>

              <dd className="text-slate-200">{String(recording.duration ?? '—')}s</dd>

            </div>

            <div>

              <dt className="hf-muted">Size</dt>

              <dd className="text-slate-200">{sizeMb}</dd>

            </div>

          </dl>

          <div className="pt-2 flex gap-3">

            <DeleteButton

              label="Delete recording"

              confirmTitle="Delete recording?"

              confirmMessage={`Remove "${objectKey}" from the catalog and delete the file from storage?`}

              onDelete={async () => {

                await api.deleteRecording(recordingId!);

                navigate('/recordings');

              }}

            />

          </div>

          <p className="text-xs hf-muted">

            Play opens an HTTP-FLV preview via the API. Copy signed link / embed from the preview

            modal for external sharing.

          </p>

        </Card>

      )}

    </ResourceSettingsLayout>

  );

};



export default RecordingSettingsPage;

