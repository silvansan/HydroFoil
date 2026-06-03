import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { useResourceList } from '../hooks/useResourceList';

type FeedRow = {
  id: string;
  name: string;
  enabled: boolean;
  outputContainer: string;
  outputCodecs: string[];
  storageLocationName?: string;
  generateDuringLive: boolean;
};

const AudioFeedProfilesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<FeedRow>(() =>
    api.listAudioFeedProfiles()
  );
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    outputContainer: 'mp3' as 'mp3' | 'aac' | 'ogg' | 'hls',
    outputCodec: 'mp3' as 'mp3' | 'aac' | 'opus',
    storageLocationId: '',
    nameTemplate: '{app}/{streamKey}/audio/{timestamp}.mp3',
    generateDuringLive: false,
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.listStorageLocations().then((res) => {
      const rows = (res.items ?? []) as Array<{ id: string; name: string }>;
      setLocations(rows);
      if (rows[0]) setForm((f) => ({ ...f, storageLocationId: f.storageLocationId || rows[0].id }));
    });
  }, []);

  const handleCreate = async () => {
    setSubmitError(null);
    try {
      await api.createAudioFeedProfile({
        name: form.name.trim(),
        outputContainer: form.outputContainer,
        outputCodecs: [form.outputCodec],
        storageLocationId: form.storageLocationId,
        nameTemplate: form.nameTemplate.trim(),
        generateDuringLive: form.generateDuringLive,
      });
      setIsModalOpen(false);
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create audio feed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Audio Feed Profiles"
        description="Extract MP3/AAC/Opus from DVR or finalized recordings — assign profiles on each stream key"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)} disabled={locations.length === 0}>
            + New Audio Feed
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}
      {locations.length === 0 && !isLoading && (
        <Alert>Create a storage location first (Storage page).</Alert>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Audio feeds</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading audio feeds…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No audio feed profiles yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Format</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Storage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Live</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((feed) => (
                  <tr key={feed.id} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-sm text-slate-200">{feed.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 uppercase">
                      {feed.outputContainer} / {feed.outputCodecs.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{feed.storageLocationName ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {feed.generateDuringLive ? 'DVR at unpublish' : 'After recording'}
                    </td>
                    <RowActionsCell className="px-4 py-3">
                      <DeleteButton
                        label="Delete audio feed"
                        confirmTitle="Delete audio feed profile?"
                        confirmMessage={`Remove "${feed.name}"?`}
                        onDelete={async () => {
                          await api.deleteAudioFeedProfile(feed.id);
                          await reload();
                        }}
                      />
                    </RowActionsCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Audio Feed">
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <label className="block text-sm">
            <span className="hf-muted mb-1 block">Container</span>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
              value={form.outputContainer}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  outputContainer: e.target.value as 'mp3' | 'aac' | 'ogg' | 'hls',
                }))
              }
            >
              <option value="mp3">MP3</option>
              <option value="aac">AAC</option>
              <option value="ogg">OGG</option>
              <option value="hls">HLS (audio)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="hf-muted mb-1 block">Codec</span>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
              value={form.outputCodec}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  outputCodec: e.target.value as 'mp3' | 'aac' | 'opus',
                }))
              }
            >
              <option value="mp3">MP3</option>
              <option value="aac">AAC</option>
              <option value="opus">Opus</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="hf-muted mb-1 block">Storage location</span>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
              value={form.storageLocationId}
              onChange={(e) => setForm((f) => ({ ...f, storageLocationId: e.target.value }))}
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <TextInput
            label="Filename template"
            value={form.nameTemplate}
            onChange={(e) => setForm((f) => ({ ...f, nameTemplate: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.generateDuringLive}
              onChange={(e) => setForm((f) => ({ ...f, generateDuringLive: e.target.checked }))}
              className="rounded border-slate-600 text-brand-500"
            />
            Extract from SRS DVR when stream ends (no recording policy)
          </label>
          <p className="text-xs hf-muted">
            When a stream key has recording enabled, audio is always extracted from the finalized recording file
            (better quality). DVR mode applies only if there is no active recording on unpublish.
          </p>
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!form.name.trim() || !form.storageLocationId}
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AudioFeedProfilesPage;
