import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import { Alert } from '../components/Alert';
import { ClickableRow } from '../components/ClickableRow';
import { useResourceList } from '../hooks/useResourceList';

type DomainBlockRow = {
  id: string;
  name: string;
  slug: string;
  allowedDomains: string[];
  playbackAccessPolicy: string;
};

const DomainBlocksPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<DomainBlockRow>(() =>
    api.listDomainBlocks()
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    slug: '',
    allowedDomains: '',
    playbackAccessPolicy: 'public',
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const handleCreate = async () => {
    setSubmitError(null);
    try {
      await api.createDomainBlock({
        name: form.name,
        slug: form.slug,
        allowedDomains: form.allowedDomains.split(',').map((d) => d.trim()).filter(Boolean),
        playbackAccessPolicy: form.playbackAccessPolicy,
        tokenRequired: form.playbackAccessPolicy === 'token-required',
      });
      setIsModalOpen(false);
      setForm({ name: '', slug: '', allowedDomains: '', playbackAccessPolicy: 'public' });
      await reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create domain block');
    }
  };

  return (
    <div>
      <PageHeader
        title="Domain Blocks"
        description="Playback access boundaries — click a row for block settings"
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            + New Domain Block
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Domain blocks</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading domain blocks…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">No domain blocks yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Slug</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Domains</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Access</th>
                </tr>
              </thead>
              <tbody>
                {items.map((block) => (
                  <ClickableRow key={block.id} to={`/domain-blocks/${block.id}`}>
                    <td className="px-4 py-3 text-sm text-slate-200">{block.name}</td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-400">{block.slug}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-md truncate">
                      {block.allowedDomains?.join(', ') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{block.playbackAccessPolicy}</td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Domain Block">
        <div className="space-y-4">
          <TextInput label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <TextInput label="Slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <TextInput
            label="Allowed domains (comma-separated)"
            value={form.allowedDomains}
            onChange={(e) => setForm((f) => ({ ...f, allowedDomains: e.target.value }))}
          />
          <TextInput
            label="Playback access policy"
            value={form.playbackAccessPolicy}
            onChange={(e) => setForm((f) => ({ ...f, playbackAccessPolicy: e.target.value }))}
          />
          {submitError && <p className="text-sm text-red-400">{submitError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DomainBlocksPage;
