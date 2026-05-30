import React from 'react';
import { Copy } from 'lucide-react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Input, RestreamDestination } from '../api/types';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { IconActionButton } from '../components/IconActionButton';
import { RowActions } from '../components/RowActions';
import { StreamLiveBadge } from '../components/StreamLiveBadge';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useStreamPreviewModal } from '../hooks/useStreamPreviewModal';
import { streamMediaTargetForRestreamRow } from '../lib/stream-media';
import { errorMessage } from '../lib/api-error';
import { copyText } from '../lib/clipboard';
import { isInputPublishing } from '../lib/live-status';
import { usePublishingIndex } from '../hooks/usePublishingIndex';

type AddForm =
  | {
      type: 'rtmp_external';
      name: string;
      pushUrl: string;
    }
  | {
      type: 'srt_external';
      name: string;
      pushUrl: string;
      srtStreamId: string;
      passphrase: string;
      latency: string;
    }
  | {
      type: 'rtmp_mirror';
      name: string;
      gatewayAppName: string;
      gatewayStreamName: string;
    };

interface RestreamRow {
  input: Input;
  destination: RestreamDestination;
}

const emptyExternalForm = (): AddForm => ({
  type: 'rtmp_external',
  name: '',
  pushUrl: '',
});

const emptySrtForm = (): AddForm => ({
  type: 'srt_external',
  name: '',
  pushUrl: '',
  srtStreamId: '',
  passphrase: '',
  latency: '',
});

const deliveryLabel: Record<RestreamDestination['delivery'], string> = {
  hls: 'HLS',
  'http-flv': 'HTTP-FLV',
  rtmp: 'RTMP',
  srt: 'SRT',
};

function inputOptionLabel(input: Input): string {
  const app = input.application?.appName ?? 'live';
  const appLabel = input.application?.name ? `${input.application.name} / ` : '';
  return `${appLabel}${input.name} — ${app}/${input.streamKey}`;
}

const RestreamingPage: React.FC = () => {
  const [rows, setRows] = React.useState<RestreamRow[]>([]);
  const [inputs, setInputs] = React.useState<Input[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const { openPreview, previewModal } = useStreamPreviewModal();
  const publishingIndex = usePublishingIndex(5000);

  const [addOpen, setAddOpen] = React.useState(false);
  const [selectedInputId, setSelectedInputId] = React.useState('');
  const [addForm, setAddForm] = React.useState<AddForm>(emptyExternalForm());
  const [addKind, setAddKind] = React.useState<'rtmp_external' | 'srt_external' | 'rtmp_mirror'>('rtmp_external');
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    const [restreamRes, inputRes] = await Promise.all([api.listRestreams(), api.listInputs()]);
    setInputs(inputRes.items);

    const flat: RestreamRow[] = [];
    for (const group of restreamRes.items) {
      for (const destination of group.destinations) {
        if (destination.isSystem) continue;
        flat.push({ input: group.input, destination });
      }
    }
    flat.sort((a, b) => {
      const appA = a.input.application?.name ?? '';
      const appB = b.input.application?.name ?? '';
      if (appA !== appB) return appA.localeCompare(appB);
      const keyCmp = a.input.streamKey.localeCompare(b.input.streamKey);
      if (keyCmp !== 0) return keyCmp;
      return a.destination.name.localeCompare(b.destination.name);
    });
    setRows(flat);
  }, []);

  React.useEffect(() => {
    load()
      .catch((err) => setError(errorMessage(err, 'Failed to load restreams')))
      .finally(() => setIsLoading(false));
  }, [load]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const selectedInput = inputs.find((i) => i.id === selectedInputId);

  const openAdd = () => {
    setSubmitError(null);
    setAddKind('rtmp_external');
    setAddForm(emptyExternalForm());
    const first = inputs[0];
    setSelectedInputId(first?.id ?? '');
    setAddOpen(true);
  };

  const onInputChange = (inputId: string) => {
    setSelectedInputId(inputId);
    const input = inputs.find((i) => i.id === inputId);
    if (addForm.type === 'rtmp_mirror' && input) {
      setAddForm({
        type: 'rtmp_mirror',
        name: addForm.name,
        gatewayAppName: input.application?.appName ?? 'live',
        gatewayStreamName: addForm.gatewayStreamName,
      });
    }
  };

  const handleCreate = async () => {
    if (!selectedInputId) {
      setSubmitError('Select a source stream key');
      return;
    }
    const name = addForm.name.trim();
    if (!name) {
      setSubmitError('Enter a name for this restream');
      return;
    }

    setSubmitError(null);
    if (addForm.type === 'rtmp_external' && !addForm.pushUrl.trim()) {
      setSubmitError('Enter an RTMP push URL');
      return;
    }
    if (addForm.type === 'srt_external' && !addForm.pushUrl.trim()) {
      setSubmitError('Enter an SRT push URL (srt://host:port)');
      return;
    }
    if (
      addForm.type === 'rtmp_mirror' &&
      (!addForm.gatewayAppName.trim() || !addForm.gatewayStreamName.trim())
    ) {
      setSubmitError('Enter SRS application and stream name');
      return;
    }

    setIsSubmitting(true);
    try {
      if (addForm.type === 'rtmp_external') {
        await api.createRestream(selectedInputId, {
          type: 'rtmp_external',
          name,
          pushUrl: addForm.pushUrl.trim(),
        });
      } else if (addForm.type === 'srt_external') {
        const latency = addForm.latency.trim() ? Number(addForm.latency) : undefined;
        await api.createRestream(selectedInputId, {
          type: 'srt_external',
          name,
          pushUrl: addForm.pushUrl.trim(),
          srtStreamId: addForm.srtStreamId.trim() || undefined,
          passphrase: addForm.passphrase.trim() || undefined,
          latency: latency != null && !Number.isNaN(latency) ? latency : undefined,
        });
      } else {
        await api.createRestream(selectedInputId, {
          type: 'rtmp_mirror',
          name,
          gatewayAppName: addForm.gatewayAppName.trim(),
          gatewayStreamName: addForm.gatewayStreamName.trim(),
        });
      }
      setAddOpen(false);
      await load();
      notify('Restream added');
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to add restream'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUrl = async (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    const ok = await copyText(url);
    notify(ok ? 'URL copied' : 'Copy failed');
  };

  return (
    <div>
      <PageHeader
        title="Restreaming"
        description="Push live streams to external RTMP/SRT servers or other SRS paths — click a row for settings"
        action={
          <Button variant="primary" onClick={openAdd} disabled={inputs.length === 0}>
            + Add restream
          </Button>
        }
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {previewModal}

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="py-12 text-center hf-muted">Loading restreams…</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Restream destinations</h2>
            <span className="text-sm hf-muted">{rows.length} configured</span>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center hf-muted space-y-2">
              <p>No restream destinations yet.</p>
              <p className="text-sm max-w-md mx-auto">
                Use <strong className="text-slate-300">+ Add restream</strong> to forward a stream key. Create stream keys on{' '}
                <a href="/inputs" className="text-brand-400 hover:text-brand-300">
                  Inputs
                </a>{' '}
                first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/40">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Source stream key
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Destination
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Target URL
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ input, destination: dest }) => {
                    const appName = input.application?.appName ?? 'live';
                    const mediaTarget = streamMediaTargetForRestreamRow(input, dest);

                    return (
                      <ClickableRow key={dest.id} to={`/restreams/${dest.id}`}>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-200 font-medium">{input.name}</span>
                            <code className="text-xs text-slate-500 font-mono">
                              {appName}/{input.streamKey}
                            </code>
                            {isInputPublishing(input, publishingIndex) && <StreamLiveBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-200">{dest.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-xs uppercase text-slate-500">
                            {deliveryLabel[dest.delivery]}
                          </span>
                          {dest.kind === 'external' && (
                            <span className="ml-2 text-xs text-amber-400/90">external</span>
                          )}
                          {dest.kind === 'local_mirror' && (
                            <span className="ml-2 text-xs text-slate-500">mirror</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-500 max-w-md truncate">
                          <span title={dest.copyUrl}>{dest.copyUrl}</span>
                        </td>
                        <RowActionsCell className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <StreamMediaActions
                              target={mediaTarget}
                              onPreview={() => openPreview(mediaTarget)}
                              onNotify={notify}
                            />
                            <IconActionButton
                              label="Copy destination URL"
                              icon={Copy}
                              onClick={(e) => copyUrl(e, dest.copyUrl)}
                            />
                            <RowActions
                              name={dest.name}
                              enabled={dest.enabled}
                              onToggle={async () => {
                                await api.updateRestream(dest.id, { enabled: !dest.enabled });
                                await load();
                              }}
                              onDelete={async () => {
                                await api.deleteRestream(dest.id);
                                await load();
                              }}
                              deleteConfirm={`Remove restream "${dest.name}"?`}
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
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add restream">
        <div className="space-y-4">
          {inputs.length === 0 ? (
            <p className="text-sm hf-muted">
              Create a stream key on the{' '}
              <a href="/inputs" className="text-brand-400">
                Inputs
              </a>{' '}
              page first.
            </p>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-slate-300">Source stream key</label>
                <select
                  className="hf-select mt-1 w-full"
                  value={selectedInputId}
                  onChange={(e) => onInputChange(e.target.value)}
                >
                  {inputs.map((input) => (
                    <option key={input.id} value={input.id}>
                      {inputOptionLabel(input)}
                    </option>
                  ))}
                </select>
                {selectedInput && (
                  <p className="hf-muted mt-1 text-xs">
                    Live when publishing to this key&apos;s ingest URL (see Inputs).
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-300">Destination type</label>
                <select
                  className="hf-select mt-1"
                  value={addKind}
                  onChange={(e) => {
                    const kind = e.target.value as 'rtmp_external' | 'srt_external' | 'rtmp_mirror';
                    setAddKind(kind);
                    const app = selectedInput?.application?.appName ?? 'live';
                    if (kind === 'rtmp_external') {
                      setAddForm(emptyExternalForm());
                    } else if (kind === 'srt_external') {
                      setAddForm(emptySrtForm());
                    } else {
                      setAddForm({
                        type: 'rtmp_mirror',
                        name: addForm.name,
                        gatewayAppName: app,
                        gatewayStreamName: '',
                      });
                    }
                  }}
                >
                  <option value="rtmp_external">External RTMP</option>
                  <option value="srt_external">External SRT</option>
                  <option value="rtmp_mirror">Local app/stream</option>
                </select>
              </div>

              <TextInput
                label="Destination name"
                placeholder="Other Server"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />

              {addForm.type === 'rtmp_external' ? (
                <TextInput
                  label="RTMP push URL"
                  placeholder="rtmp://a.rtmp.server.com/live/your-key"
                  value={addForm.pushUrl}
                  onChange={(e) =>
                    setAddForm((f) =>
                      f.type === 'rtmp_external' ? { ...f, pushUrl: e.target.value } : f
                    )
                  }
                />
              ) : addForm.type === 'srt_external' ? (
                <>
                  <TextInput
                    label="SRT push URL"
                    placeholder="srt://192.168.1.50:10080"
                    value={addForm.pushUrl}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'srt_external' ? { ...f, pushUrl: e.target.value } : f
                      )
                    }
                  />
                  <TextInput
                    label="Stream ID (optional)"
                    placeholder="#!::r=live/your-key,m=publish"
                    value={addForm.srtStreamId}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'srt_external' ? { ...f, srtStreamId: e.target.value } : f
                      )
                    }
                  />
                  <TextInput
                    label="Passphrase (optional)"
                    placeholder="10–79 characters if required by receiver"
                    value={addForm.passphrase}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'srt_external' ? { ...f, passphrase: e.target.value } : f
                      )
                    }
                  />
                  <TextInput
                    label="Latency ms (optional)"
                    placeholder="300"
                    value={addForm.latency}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'srt_external' ? { ...f, latency: e.target.value } : f
                      )
                    }
                  />
                  <p className="text-xs hf-muted">
                    FFmpeg pushes from SRS when the source stream key goes live. SRT destinations are
                    not forwarded by SRS directly.
                  </p>
                </>
              ) : (
                <>
                  <TextInput
                    label="SRS application"
                    placeholder="GTCH"
                    value={addForm.gatewayAppName}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'rtmp_mirror' ? { ...f, gatewayAppName: e.target.value } : f
                      )
                    }
                  />
                  <TextInput
                    label="Stream name"
                    placeholder="EN"
                    value={addForm.gatewayStreamName}
                    onChange={(e) =>
                      setAddForm((f) =>
                        f.type === 'rtmp_mirror' ? { ...f, gatewayStreamName: e.target.value } : f
                      )
                    }
                  />
                </>
              )}

              <FormError message={submitError} />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreate} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding…' : 'Add restream'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RestreamingPage;
