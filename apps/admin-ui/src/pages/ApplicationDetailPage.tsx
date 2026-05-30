import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, Card, Button, Modal } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Application, Input } from '../api/types';
import { Alert } from '../components/Alert';
import { FormError } from '../components/FormError';
import { EditStreamKeyModal, inputToForm } from '../components/EditStreamKeyModal';
import { errorMessage } from '../lib/api-error';
import { InputFormFields, emptyInputForm } from '../components/InputFormFields';
import { StreamKeyActions } from '../components/StreamKeyActions';
import { useStreamPreviewModal } from '../hooks/useStreamPreviewModal';
import { useStreamMonitorModal } from '../hooks/useStreamMonitorModal';
import { StreamLiveBadge } from '../components/StreamLiveBadge';
import { usePublishingIndex } from '../hooks/usePublishingIndex';
import { isInputPublishing } from '../lib/live-status';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { CopyableUrl } from '../components/CopyableUrl';
import { rtmpIngestUrl } from '../lib/stream';

const ApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const [application, setApplication] = React.useState<Application | null>(null);
  const [inputs, setInputs] = React.useState<Input[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyInputForm);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const publishingIndex = usePublishingIndex(5000);
  const [toast, setToast] = React.useState<string | null>(null);
  const { openPreview, previewModal } = useStreamPreviewModal();
  const { openMonitor, monitorModal } = useStreamMonitorModal();
  const [editTarget, setEditTarget] = React.useState<Input | null>(null);
  const [editForm, setEditForm] = React.useState(emptyInputForm());
  const [editEnabled, setEditEnabled] = React.useState(true);
  const [editSubmitError, setEditSubmitError] = React.useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const load = React.useCallback(async () => {
    if (!applicationId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getApplicationInputs(applicationId);
      setApplication(data.application);
      setInputs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const canSubmit = form.name.trim().length > 0 && form.streamKey.trim().length > 0;

  const openAddInput = () => {
    setSubmitError(null);
    setForm(emptyInputForm());
    setIsModalOpen(true);
  };

  const handleCreateInput = async () => {
    if (!applicationId || !canSubmit) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await api.createInput({
        applicationId,
        name: form.name.trim(),
        streamKey: form.streamKey.trim(),
        ingestProtocol: form.ingestProtocol,
        enabled: true,
      });
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setSubmitError(errorMessage(err, 'Failed to create stream key'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (input: Input) => {
    setEditTarget(input);
    setEditForm(inputToForm(input));
    setEditEnabled(input.enabled);
    setEditSubmitError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditSubmitting(true);
    setEditSubmitError(null);
    try {
      await api.updateInput(editTarget.id, {
        name: editForm.name.trim(),
        streamKey: editForm.streamKey.trim(),
        ingestProtocol: editForm.ingestProtocol,
        enabled: editEnabled,
      });
      setEditTarget(null);
      await load();
      notify('Stream key saved');
    } catch (err) {
      setEditSubmitError(errorMessage(err, 'Failed to save'));
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleRecord = async (input: Input) => {
    try {
      const result = await api.startInputRecording(input.id);
      notify(
        result.alreadyRecording
          ? `Already recording "${input.name}"`
          : `Recording started for "${input.name}"`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  if (!applicationId) {
    return <Alert>Missing application id</Alert>;
  }

  const appName = application?.appName ?? '…';

  return (
    <div>
      <Link
        to="/inputs"
        className="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 mb-4"
      >
        <ArrowLeft size={16} />
        All applications
      </Link>

      <PageHeader
        title={application?.name ?? 'Application'}
        description={
          application
            ? `SRS application /${application.appName}/ — add stream keys for languages or feeds`
            : 'Loading…'
        }
        action={
          <Button variant="primary" onClick={openAddInput} disabled={!application}>
            + Add stream key
          </Button>
        }
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {previewModal}
      {monitorModal}

      <EditStreamKeyModal
        isOpen={editTarget !== null}
        appName={appName}
        form={editForm}
        enabled={editEnabled}
        submitError={editSubmitError}
        isSubmitting={editSubmitting}
        onClose={() => setEditTarget(null)}
        onChange={setEditForm}
        onEnabledChange={setEditEnabled}
        onSave={handleSaveEdit}
      />

      {error && <Alert>{error}</Alert>}

      {application && (
        <Card className="mb-6 px-6 py-4 border border-slate-700/50">
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="hf-muted">Application slug (RTMP path)</dt>
              <dd className="font-mono text-brand-300 mt-0.5">/{application.appName}/</dd>
            </div>
            <div>
              <dt className="hf-muted">Stream keys</dt>
              <dd className="text-slate-100 mt-0.5">{inputs.length}</dd>
            </div>
            {application.description && (
              <div className="sm:col-span-2">
                <dt className="hf-muted">Description</dt>
                <dd className="text-slate-200 mt-0.5">{application.description}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Stream keys</h2>
        </div>
        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading…</div>
        ) : inputs.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            No stream keys yet. Add one for each language or purpose.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {inputs.map((input) => (
              <ClickableRow
                key={input.id}
                as="li"
                to={`/stream-keys/${input.id}`}
                className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-100 font-medium">{input.name}</span>
                    <span className="font-mono text-sm text-slate-400">{input.streamKey}</span>
                    {isInputPublishing(input, publishingIndex) && <StreamLiveBadge />}
                    {!input.enabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/80 text-slate-400 border border-slate-600">
                        Disabled
                      </span>
                    )}
                  </div>
                  <CopyableUrl
                    url={rtmpIngestUrl(input.streamKey, appName)}
                    className="text-xs break-all max-w-full"
                    onCopied={notify}
                  />
                </div>
                <RowActionsCell as="div" className="flex items-center gap-1 shrink-0">
                  <StreamKeyActions
                    input={input}
                    appName={appName}
                    isPublishing={isInputPublishing(input, publishingIndex)}
                    onPreview={() =>
                      openPreview({
                        streamKey: input.streamKey,
                        gatewayApp: appName,
                        label: input.name,
                        status: isInputPublishing(input, publishingIndex)
                          ? 'publishing'
                          : undefined,
                      })
                    }
                    onMonitor={() =>
                      openMonitor({
                        streamKey: input.streamKey,
                        gatewayApp: appName,
                        label: input.name,
                        status: 'publishing',
                      })
                    }
                    onNotify={notify}
                    onEdit={() => openEdit(input)}
                    onRecord={() => handleRecord(input)}
                    onDeleted={load}
                  />
                </RowActionsCell>
              </ClickableRow>
            ))}
          </ul>
        )}
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New stream key">
        <InputFormFields appName={appName} form={form} onChange={setForm} />
        <div className="mt-3">
          <FormError message={submitError} />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateInput} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Create stream key'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationDetailPage;
