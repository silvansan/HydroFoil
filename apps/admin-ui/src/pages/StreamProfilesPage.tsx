import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { useResourceList } from '../hooks/useResourceList';

type ProfileRow = {
  id: string;
  name: string;
  mode: 'passthrough' | 'transcode';
  audioHandling: string;
  renditions?: Array<{ name: string; resolution: string }>;
};

const StreamProfilesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<ProfileRow>(() =>
    api.listStreamProfiles()
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    mode: 'passthrough' as 'passthrough' | 'transcode',
    audioHandling: 'copy' as 'copy' | 'aac' | 'opus',
    renditionName: '720p',
    resolution: '1280x720',
    videoBitrate: '2500',
    fps: '30',
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    setSubmitError(null);
    try {
      const renditions =
        form.mode === 'transcode'
          ? [
              {
                name: form.renditionName.trim() || '720p',
                resolution: form.resolution.trim(),
                videoBitrate: Number(form.videoBitrate) || 2500,
                videoCodec: 'h264',
                fps: Number(form.fps) || 30,
              },
            ]
          : [];

      await api.createStreamProfile({
        name: form.name.trim(),
        mode: form.mode,
        audioHandling: form.audioHandling,
        renditions,
      });
      setIsModalOpen(false);
      setForm({
        name: '',
        mode: 'passthrough',
        audioHandling: 'copy',
        renditionName: '720p',
        resolution: '1280x720',
        videoBitrate: '2500',
        fps: '30',
      });
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create profile');
    }
  };

  return (
    <div>
      <PageHeader
        title="Stream Profiles"
        description="ABR / transcode definitions — assign to stream keys for gateway desired config"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + New Profile
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Profiles</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading profiles…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No stream profiles yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Mode</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Audio</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Renditions</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((profile) => (
                  <tr key={profile.id} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 text-sm text-slate-200">{profile.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 uppercase">{profile.mode}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{profile.audioHandling}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-500">
                      {profile.renditions?.length
                        ? profile.renditions.map((r) => r.name).join(', ')
                        : '—'}
                    </td>
                    <RowActionsCell className="px-4 py-3">
                      <DeleteButton
                        label="Delete profile"
                        confirmTitle="Delete stream profile?"
                        confirmMessage={`Remove "${profile.name}"? Assigned stream keys keep their ID until cleared.`}
                        onDelete={async () => {
                          await api.deleteStreamProfile(profile.id);
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Stream Profile">
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <label className="block text-sm">
            <span className="hf-muted mb-1 block">Mode</span>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
              value={form.mode}
              onChange={(e) =>
                setForm((f) => ({ ...f, mode: e.target.value as 'passthrough' | 'transcode' }))
              }
            >
              <option value="passthrough">Passthrough</option>
              <option value="transcode">Transcode (ABR)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="hf-muted mb-1 block">Audio handling</span>
            <select
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200"
              value={form.audioHandling}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  audioHandling: e.target.value as 'copy' | 'aac' | 'opus',
                }))
              }
            >
              <option value="copy">Copy</option>
              <option value="aac">AAC</option>
              <option value="opus">Opus</option>
            </select>
          </label>
          {form.mode === 'transcode' && (
            <>
              <TextInput
                label="Rendition name"
                value={form.renditionName}
                onChange={(e) => setForm((f) => ({ ...f, renditionName: e.target.value }))}
              />
              <TextInput
                label="Resolution"
                placeholder="1280x720"
                value={form.resolution}
                onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))}
              />
              <TextInput
                label="Video bitrate (kbps)"
                value={form.videoBitrate}
                onChange={(e) => setForm((f) => ({ ...f, videoBitrate: e.target.value }))}
              />
              <TextInput
                label="FPS"
                value={form.fps}
                onChange={(e) => setForm((f) => ({ ...f, fps: e.target.value }))}
              />
            </>
          )}
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!form.name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default StreamProfilesPage;
