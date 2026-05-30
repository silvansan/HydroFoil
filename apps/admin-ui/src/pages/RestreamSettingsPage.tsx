import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, TextInput, Button } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Input, RestreamDestination } from '../api/types';
import { Alert } from '../components/Alert';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { RowActions } from '../components/RowActions';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useStreamPreviewModal } from '../hooks/useStreamPreviewModal';
import { streamMediaTargetForRestreamRow } from '../lib/stream-media';
import { CopyableUrl } from '../components/CopyableUrl';

const RestreamSettingsPage: React.FC = () => {
  const { destinationId } = useParams<{ destinationId: string }>();
  const navigate = useNavigate();
  const [destination, setDestination] = React.useState<RestreamDestination | null>(null);
  const [input, setInput] = React.useState<Input | null>(null);
  const [name, setName] = React.useState('');
  const [pushUrl, setPushUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const { openPreview, previewModal } = useStreamPreviewModal();

  const load = React.useCallback(async () => {
    if (!destinationId) return;
    const data = await api.getRestream(destinationId);
    setDestination(data.destination);
    setInput(data.input);
    setName(data.destination.name);
    setPushUrl(data.destination.kind === 'external' ? data.destination.copyUrl : '');
  }, [destinationId]);

  React.useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    if (!destinationId) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.updateRestream(destinationId, {
        name: name.trim(),
        ...(destination?.kind === 'external' ? { pushUrl: pushUrl.trim() } : {}),
      });
      await load();
      notify('Restream saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const mediaTarget =
    input && destination ? streamMediaTargetForRestreamRow(input, destination) : null;

  return (
    <ResourceSettingsLayout
      backTo="/restreaming"
      backLabel="All restreams"
      title={destination?.name ?? 'Restream'}
      description={
        input ? (
          <span>
            From{' '}
            <Link to={`/stream-keys/${input.id}`} className="text-brand-400 hover:underline">
              {input.name}
            </Link>{' '}
            <span className="font-mono text-slate-500">
              ({input.application?.appName ?? 'live'}/{input.streamKey})
            </span>
          </span>
        ) : undefined
      }
      action={
        mediaTarget ? (
          <StreamMediaActions
            target={mediaTarget}
            onPreview={() => openPreview(mediaTarget)}
            onNotify={notify}
          />
        ) : undefined
      }
    >
      {previewModal}
      {error && <Alert>{error}</Alert>}
      {saveError && <Alert>{saveError}</Alert>}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      {destination && input && (
        <Card className="p-6 space-y-4 max-w-xl">
          <TextInput label="Destination name" value={name} onChange={(e) => setName(e.target.value)} />
          {destination.kind === 'external' && (
            <TextInput
              label={destination.delivery === 'srt' ? 'SRT push URL' : 'RTMP push URL'}
              value={pushUrl}
              onChange={(e) => setPushUrl(e.target.value)}
            />
          )}
          <div>
            <p className="text-sm font-medium text-slate-300 mb-1">Target URL</p>
            <CopyableUrl url={destination.copyUrl} className="text-xs break-all" onCopied={notify} />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
            <RowActions
              name={destination.name}
              enabled={destination.enabled}
              onToggle={async () => {
                await api.updateRestream(destination.id, { enabled: !destination.enabled });
                await load();
              }}
              onDelete={async () => {
                await api.deleteRestream(destination.id);
                navigate('/restreaming');
              }}
              deleteConfirm={`Remove restream "${destination.name}"?`}
            />
          </div>
        </Card>
      )}
    </ResourceSettingsLayout>
  );
};

export default RestreamSettingsPage;
