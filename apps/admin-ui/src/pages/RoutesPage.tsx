import React from 'react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';
import { ArrowRight } from 'lucide-react';

import { api } from '../api/client';
import type { Input, Output, Route } from '../api/types';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';
import { LivePreviewModal } from '../components/LivePreviewModal';
import { PlayButton } from '../components/PlayButton';
import { RowActions } from '../components/RowActions';
import { StreamLiveBadge } from '../components/StreamLiveBadge';
import { errorMessage } from '../lib/api-error';
import { isInputPublishing } from '../lib/live-status';
import { inputWatchTarget, outputWatchTarget } from '../lib/watch-target';
import { usePublishingIndex } from '../hooks/usePublishingIndex';
import { useResourceList } from '../hooks/useResourceList';
import { rtmpIngestUrl } from '../lib/stream';

const RoutesPage: React.FC = () => {
  const { items, isLoading, error, reload } = useResourceList<Route>(() => api.listRoutes());
  const publishingIndex = usePublishingIndex(5000);
  const [inputs, setInputs] = React.useState<Input[]>([]);
  const [outputs, setOutputs] = React.useState<Output[]>([]);
  const [preview, setPreview] = React.useState<{
    gatewayApp: string;
    streamKey: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    inputId: '',
    outputIds: [] as string[],
  });
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadCatalog = React.useCallback(async () => {
    const [inputRes, outputRes] = await Promise.all([api.listInputs(), api.listOutputs()]);
    setInputs(inputRes.items);
    setOutputs(outputRes.items);
  }, []);

  React.useEffect(() => {
    loadCatalog().catch(() => undefined);
  }, [loadCatalog]);

  const openModal = async () => {
    setSubmitError(null);
    setForm({ name: '', inputId: '', outputIds: [] });
    await loadCatalog();
    setIsModalOpen(true);
  };

  const canSubmit =
    form.name.trim().length > 0 && form.inputId.length > 0 && form.outputIds.length > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.createRoute({
        name: form.name.trim(),
        inputId: form.inputId,
        outputIds: form.outputIds,
        enabled: true,
      });
      setIsModalOpen(false);
      await reload();
      await loadCatalog();
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to create route'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleOutput = (outputId: string) => {
    setForm((f) => ({
      ...f,
      outputIds: f.outputIds.includes(outputId)
        ? f.outputIds.filter((id) => id !== outputId)
        : [...f.outputIds, outputId],
    }));
  };

  const resolveRouteSummary = (route: Route) => {
    const input = inputs.find((i) => i.id === route.inputId);
    const routeOutputs = outputs.filter((o) => route.outputIds.includes(o.id));
    return { input, routeOutputs };
  };

  const toggleRoute = async (route: Route) => {
    await api.updateRoute(route.id, { enabled: !route.enabled });
    await reload();
  };

  const openWatch = (target: { gatewayApp: string; streamKey: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(target);
  };

  const selectedInput = inputs.find((i) => i.id === form.inputId);

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Connect an input stream key to one or more output destinations"
        action={
          <Button variant="primary" onClick={openModal}>
            + New Route
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
          <h2 className="text-lg font-semibold text-slate-100">Routes</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading routes…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            Create at least one input and one output, then add a route to connect them.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {items.map((route) => {
              const { input, routeOutputs } = resolveRouteSummary(route);
              if (!input) return null;
              const inputLive = isInputPublishing(input, publishingIndex);
              const inputWatch = inputWatchTarget(input);

              return (
                <li
                  key={route.id}
                  className="px-6 py-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-100 font-semibold">{route.name}</span>
                      {route.enabled ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/20 text-brand-300 border border-brand-500/30">
                          Route on
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-400 border border-slate-600">
                          Route off
                        </span>
                      )}
                      {inputLive && <StreamLiveBadge />}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                      <span className="font-medium">{input.name}</span>
                      <code className="text-xs text-brand-400 bg-slate-900/80 px-1.5 py-0.5 rounded font-mono">
                        {input.streamKey}
                      </code>
                      <ArrowRight size={14} className="text-slate-500 shrink-0" />
                      <span className="text-slate-400">
                        {routeOutputs.map((o) => o.name).join(', ') || '—'}
                      </span>
                    </div>

                    <p className="font-mono text-xs text-slate-500 break-all">
                      Ingest:{' '}
                      {rtmpIngestUrl(input.streamKey, input.application?.appName ?? 'live')}
                    </p>

                    {routeOutputs.length > 0 && (
                      <ul className="space-y-1">
                        {routeOutputs.map((output) => {
                          const outWatch = outputWatchTarget(output);
                          return (
                            <li
                              key={output.id}
                              className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
                            >
                              <span>
                                {output.name}: {output.gatewayAppName}/{output.gatewayStreamName}
                              </span>
                              {outWatch && (
                                <PlayButton
                                  label={outWatch.label}
                                  onClick={(e) =>
                                    openWatch(
                                      {
                                        gatewayApp: outWatch.gatewayApp,
                                        streamKey: outWatch.streamKey,
                                      },
                                      e
                                    )
                                  }
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <RowActions
                    name={route.name}
                    enabled={route.enabled}
                    onToggle={() => toggleRoute(route)}
                    onDelete={async () => {
                      await api.deleteRoute(route.id);
                      await reload();
                      await loadCatalog();
                    }}
                    deleteConfirm={`Delete route "${route.name}"?`}
                    playLabel={inputWatch.label}
                    onPlay={(e) =>
                      openWatch(
                        {
                          gatewayApp: inputWatch.gatewayApp,
                          streamKey: inputWatch.streamKey,
                        },
                        e
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Route">
        <div className="space-y-4">
          <TextInput
            label="Route Name"
            placeholder="Main to HLS"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div>
            <label className="text-sm font-medium text-slate-300">Input (stream key)</label>
            <select
              className="hf-select mt-1"
              value={form.inputId}
              onChange={(e) => setForm((f) => ({ ...f, inputId: e.target.value }))}
            >
              <option value="">Select input…</option>
              {inputs.map((input) => (
                <option key={input.id} value={input.id}>
                  {input.application?.name ?? 'App'} / {input.name} — {input.streamKey}
                </option>
              ))}
            </select>
            {selectedInput && (
              <p className="hf-muted mt-1 font-mono text-xs break-all">
                {rtmpIngestUrl(
                  selectedInput.streamKey,
                  selectedInput.application?.appName ?? 'live'
                )}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">Outputs</label>
            {outputs.length === 0 ? (
              <p className="hf-muted mt-2">Create an output first.</p>
            ) : (
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {outputs.map((output) => (
                  <label
                    key={output.id}
                    className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:bg-white/5 rounded px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={form.outputIds.includes(output.id)}
                      onChange={() => toggleOutput(output.id)}
                      className="rounded border-slate-600 text-brand-500"
                    />
                    <span>
                      {output.name}{' '}
                      <span className="text-brand-400/90">
                        ({output.gatewayAppName}/{output.gatewayStreamName})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <FormError message={submitError} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Create Route'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoutesPage;
