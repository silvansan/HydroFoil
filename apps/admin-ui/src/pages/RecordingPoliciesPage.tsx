import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { useResourceList } from '../hooks/useResourceList';

type PolicyRow = {
  id: string;
  name: string;
  enabled: boolean;
  pathPrefix: string;
  filenameTemplate: string;
  storageLocationName?: string;
  bucketName?: string;
  retentionDays?: number;
  remuxToMp4?: boolean;
  keepSourceFlvHours?: number;
};

const RecordingPoliciesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<PolicyRow>(() =>
    api.listRecordingPolicies()
  );
  const [locations, setLocations] = React.useState<Array<{ id: string; name: string }>>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    storageLocationId: '',
    pathPrefix: 'dvr',
    filenameTemplate: '{app}/{streamKey}/{timestamp}.flv',
    retentionDays: '',
    remuxToMp4: false,
    keepSourceFlvFor24h: true,
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.listStorageLocations().then((res) => {
      const rows = (res.items ?? []) as Array<{ id: string; name: string }>;
      setLocations(rows);
      if (rows[0] && !form.storageLocationId) {
        setForm((f) => ({ ...f, storageLocationId: rows[0].id }));
      }
    });
  }, []);

  const handleCreate = async () => {
    setSubmitError(null);
    try {
      await api.createRecordingPolicy({
        name: form.name,
        storageLocationId: form.storageLocationId,
        pathPrefix: form.pathPrefix,
        filenameTemplate: form.filenameTemplate,
        retentionDays: form.retentionDays ? Number(form.retentionDays) : undefined,
        remuxToMp4: form.remuxToMp4,
        keepSourceFlvHours: form.remuxToMp4 && form.keepSourceFlvFor24h ? 24 : null,
      });
      setIsModalOpen(false);
      setForm({
        name: '',
        storageLocationId: locations[0]?.id ?? '',
        pathPrefix: 'dvr',
        filenameTemplate: '{app}/{streamKey}/{timestamp}.flv',
        retentionDays: '',
        remuxToMp4: false,
        keepSourceFlvFor24h: true,
      });
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  };

  return (
    <div>
      <PageHeader
        title="Recording Policies"
        description="Where and how DVR assets are stored — assign policies to stream keys"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)} disabled={locations.length === 0}>
            + New Policy
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}
      {locations.length === 0 && !isLoading && (
        <Alert>Create a storage location first (Storage page).</Alert>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Policies</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading policies…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No recording policies yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Storage</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Path prefix</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Finalize</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((policy) => (
                  <ClickableRow key={policy.id} to={`/recording-policies/${policy.id}`}>
                    <td className="px-4 py-3 text-sm text-slate-200">{policy.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {policy.storageLocationName ?? '—'}
                      {policy.bucketName ? (
                        <span className="block font-mono text-xs hf-muted">{policy.bucketName}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">{policy.pathPrefix}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {policy.remuxToMp4 ? 'MP4 remux' : 'FLV'}
                      {policy.keepSourceFlvHours ? (
                        <span className="block text-xs hf-muted">
                          Keep FLV {policy.keepSourceFlvHours}h
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </td>
                    <RowActionsCell className="px-4 py-3">
                      <DeleteButton
                        label="Delete policy"
                        confirmTitle="Delete recording policy?"
                        confirmMessage={`Remove "${policy.name}"? Existing recordings are not deleted.`}
                        onDelete={async () => {
                          await api.deleteRecordingPolicy(policy.id);
                          await reload();
                        }}
                      />
                    </RowActionsCell>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Recording Policy">
        <div className="space-y-4">
          <TextInput
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
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
            label="Path prefix"
            value={form.pathPrefix}
            onChange={(e) => setForm((f) => ({ ...f, pathPrefix: e.target.value }))}
          />
          <TextInput
            label="Filename template"
            value={form.filenameTemplate}
            onChange={(e) => setForm((f) => ({ ...f, filenameTemplate: e.target.value }))}
          />
          <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 space-y-3">
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.remuxToMp4}
                onChange={(e) => setForm((f) => ({ ...f, remuxToMp4: e.target.checked }))}
              />
              <span>
                <span className="font-medium">Mux into MP4 when live is finished</span>
                <span className="block text-xs hf-muted">
                  Keep SRS recording in FLV while live, then remux to MP4 after stop/unpublish.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.keepSourceFlvFor24h}
                disabled={!form.remuxToMp4}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keepSourceFlvFor24h: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium">Keep source FLV for 24 hours</span>
                <span className="block text-xs hf-muted">
                  Useful as a recovery copy if remux/playback validation needs a fallback.
                </span>
              </span>
            </label>
          </div>
          <TextInput
            label="Retention (days, optional)"
            value={form.retentionDays}
            onChange={(e) => setForm((f) => ({ ...f, retentionDays: e.target.value }))}
          />
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!form.name || !form.storageLocationId}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RecordingPoliciesPage;
