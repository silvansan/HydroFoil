import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Output } from '../api/types';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';
import { LivePreviewModal } from '../components/LivePreviewModal';
import { RowActions } from '../components/RowActions';
import { errorMessage } from '../lib/api-error';
import { outputWatchTarget } from '../lib/watch-target';
import { useResourceList } from '../hooks/useResourceList';
import { suggestPlaybackTarget } from '../lib/stream';

const OutputsPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<Output>(() => api.listOutputs());
  const [preview, setPreview] = React.useState<{
    gatewayApp: string;
    streamKey: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    routeTarget: '',
    playbackProtocol: 'hls' as Output['playbackProtocol'],
    gatewayAppName: 'live',
    gatewayStreamName: '',
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.gatewayAppName.trim().length > 0 &&
    form.gatewayStreamName.trim().length > 0;

  const applySuggestedTarget = (next: typeof form) => {
    if (!next.routeTarget.trim()) {
      next.routeTarget = suggestPlaybackTarget(
        next.playbackProtocol,
        next.gatewayAppName,
        next.gatewayStreamName
      );
    }
    return next;
  };

  const openModal = () => {
    setSubmitError(null);
    setForm({
      name: '',
      routeTarget: '',
      playbackProtocol: 'hls',
      gatewayAppName: 'live',
      gatewayStreamName: '',
    });
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload = applySuggestedTarget({ ...form });
      await api.createOutput({
        name: payload.name.trim(),
        routeTarget: payload.routeTarget.trim() || suggestPlaybackTarget(
          payload.playbackProtocol,
          payload.gatewayAppName,
          payload.gatewayStreamName
        ),
        playbackProtocol: payload.playbackProtocol,
        gatewayAppName: payload.gatewayAppName.trim(),
        gatewayStreamName: payload.gatewayStreamName.trim(),
        enabled: true,
        isPublic: true,
      });
      setIsModalOpen(false);
      await reload();
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to create output'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEnabled = async (output: Output) => {
    await api.updateOutput(output.id, { enabled: !output.enabled });
    await reload();
  };

  return (
    <div>
      <PageHeader
        title="Outputs"
        description="Playback destinations — SRS application and stream name define where media is forwarded"
        action={
          <Button variant="primary" onClick={openModal}>
            + New Output
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      {preview && (
        <LivePreviewModal
          streamKey={preview.streamKey}
          gatewayApp={preview.gatewayApp}
          onClose={() => setPreview(null)}
        />
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Output destinations</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading outputs…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            Create an output with an SRS application and stream name for forwarded playback.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {items.map((output) => {
              const watch = outputWatchTarget(output);
              return (
                <li
                  key={output.id}
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-100 font-medium">{output.name}</span>
                      <span className="text-slate-500 text-sm">
                        {output.gatewayAppName}/{output.gatewayStreamName}
                      </span>
                      <span className="text-xs uppercase text-slate-500">
                        {output.playbackProtocol}
                      </span>
                      {!output.enabled && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-400 border border-slate-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-slate-500 break-all">{output.routeTarget}</p>
                  </div>
                  <RowActions
                    name={output.name}
                    enabled={output.enabled}
                    onToggle={() => toggleEnabled(output)}
                    onDelete={async () => {
                      await api.deleteOutput(output.id);
                      await reload();
                    }}
                    deleteConfirm={`Delete output "${output.name}"? Routes using it may break.`}
                    playLabel={watch?.label ?? 'HLS only'}
                    playDisabled={!watch}
                    onPlay={
                      watch
                        ? (e) => {
                            e.stopPropagation();
                            setPreview({
                              gatewayApp: watch.gatewayApp,
                              streamKey: watch.streamKey,
                            });
                          }
                        : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Output">
        <div className="space-y-4">
          <TextInput
            label="Name"
            placeholder="HLS main"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="SRS Application"
            placeholder="live"
            value={form.gatewayAppName}
            onChange={(e) =>
              setForm((f) =>
                applySuggestedTarget({ ...f, gatewayAppName: e.target.value, routeTarget: '' })
              )
            }
          />
          <TextInput
            label="Stream Name"
            placeholder="main-hls"
            value={form.gatewayStreamName}
            onChange={(e) =>
              setForm((f) =>
                applySuggestedTarget({ ...f, gatewayStreamName: e.target.value, routeTarget: '' })
              )
            }
          />
          <div>
            <label className="text-sm font-medium text-slate-300">Playback Protocol</label>
            <select
              className="hf-select mt-1"
              value={form.playbackProtocol}
              onChange={(e) =>
                setForm((f) =>
                  applySuggestedTarget({
                    ...f,
                    playbackProtocol: e.target.value as Output['playbackProtocol'],
                    routeTarget: '',
                  })
                )
              }
            >
              <option value="hls">HLS</option>
              <option value="http-flv">HTTP-FLV</option>
              <option value="rtmp">RTMP</option>
              <option value="dash">DASH</option>
            </select>
          </div>
          <TextInput
            label="Playback / Route Target"
            placeholder="Auto-suggested from app + stream"
            value={form.routeTarget}
            onChange={(e) => setForm((f) => ({ ...f, routeTarget: e.target.value }))}
          />
          <p className="hf-muted text-xs">
            Suggested:{' '}
            {suggestPlaybackTarget(form.playbackProtocol, form.gatewayAppName, form.gatewayStreamName)}
          </p>
          <FormError message={submitError} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Create Output'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OutputsPage;
