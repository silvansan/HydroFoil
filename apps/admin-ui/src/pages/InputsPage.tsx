import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { PageHeader, Card, Button, Modal, TextInput } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Application, Input } from '../api/types';
import { Alert } from '../components/Alert';
import { DeleteButton } from '../components/DeleteButton';
import { FormError } from '../components/FormError';
import { EditStreamKeyModal, inputToForm } from '../components/EditStreamKeyModal';
import { InputFormFields, emptyInputForm } from '../components/InputFormFields';
import { StreamKeyActions } from '../components/StreamKeyActions';
import { errorMessage } from '../lib/api-error';
import { useStreamPreviewModal } from '../hooks/useStreamPreviewModal';
import { useStreamMonitorModal } from '../hooks/useStreamMonitorModal';
import { useResourceList } from '../hooks/useResourceList';
import { StreamLiveBadge } from '../components/StreamLiveBadge';
import { usePublishingIndex } from '../hooks/usePublishingIndex';
import { applicationLiveCount, isInputPublishing } from '../lib/live-status';
import { slugifyAppName } from '../lib/app-slug';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { CopyableUrl } from '../components/CopyableUrl';
import { canSubmitInputForm, generateIngestUrl, resolveInputStreamKey } from '../lib/stream';
import { canManageApplications, useAuth } from '../auth/AuthContext';

const InputsPage: React.FC = () => {
  const { user } = useAuth();
  const allowAppManagement = canManageApplications(user?.role);
  const {
    items: applications,
    isLoading: appsLoading,
    error: appsError,
    reload: reloadApps,
  } = useResourceList<Application>(() => api.listApplications());

  const [allInputs, setAllInputs] = React.useState<Input[]>([]);
  const [inputsLoading, setInputsLoading] = React.useState(true);

  const [appModalOpen, setAppModalOpen] = React.useState(false);
  const [appForm, setAppForm] = React.useState({ name: '', appName: '', description: '' });
  const [appSubmitError, setAppSubmitError] = React.useState<string | null>(null);
  const [appSubmitting, setAppSubmitting] = React.useState(false);

  const [inputModal, setInputModal] = React.useState<{
    applicationId: string;
    appName: string;
  } | null>(null);
  const [inputForm, setInputForm] = React.useState(emptyInputForm);
  const [inputSubmitError, setInputSubmitError] = React.useState<string | null>(null);
  const [inputSubmitting, setInputSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const { openPreview, previewModal } = useStreamPreviewModal();
  const { openMonitor, monitorModal } = useStreamMonitorModal();
  const [editTarget, setEditTarget] = React.useState<{ input: Input; appName: string } | null>(
    null
  );
  const [editForm, setEditForm] = React.useState(emptyInputForm());
  const [editEnabled, setEditEnabled] = React.useState(true);
  const [editSubmitError, setEditSubmitError] = React.useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);
  const publishingIndex = usePublishingIndex(5000);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const loadInputs = React.useCallback(async () => {
    setInputsLoading(true);
    try {
      const result = await api.listInputs();
      setAllInputs(result.items);
    } catch {
      setAllInputs([]);
    } finally {
      setInputsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadInputs();
  }, [loadInputs, applications]);

  const inputsByApp = React.useMemo(() => {
    const map = new Map<string, Input[]>();
    for (const input of allInputs) {
      const list = map.get(input.applicationId) ?? [];
      list.push(input);
      map.set(input.applicationId, list);
    }
    return map;
  }, [allInputs]);

  const openAppModal = () => {
    setAppSubmitError(null);
    setAppForm({ name: '', appName: '', description: '' });
    setAppModalOpen(true);
  };

  const handleCreateApp = async () => {
    if (!appForm.name.trim()) return;
    setAppSubmitting(true);
    setAppSubmitError(null);
    try {
      const appName = slugifyAppName(appForm.appName.trim() || appForm.name);
      await api.createApplication({
        name: appForm.name.trim(),
        appName,
        description: appForm.description.trim() || undefined,
      });
      setAppModalOpen(false);
      await reloadApps();
      await loadInputs();
    } catch (err) {
      setAppSubmitError(errorMessage(err, 'Failed to create application'));
    } finally {
      setAppSubmitting(false);
    }
  };

  const openInputModal = (app: Application) => {
    setInputSubmitError(null);
    setInputForm(emptyInputForm());
    setInputModal({ applicationId: app.id, appName: app.appName });
  };

  const openEdit = (input: Input, appName: string) => {
    setEditTarget({ input, appName });
    setEditForm(inputToForm(input));
    setEditEnabled(input.enabled);
    setEditSubmitError(null);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditSubmitting(true);
    setEditSubmitError(null);
    try {
      await api.updateInput(editTarget.input.id, {
        name: editForm.name.trim(),
        streamKey: resolveInputStreamKey(
          editForm.name,
          editForm.ingestProtocol,
          editForm.streamKey
        ),
        ingestProtocol: editForm.ingestProtocol,
        protocolConfig: editForm.protocolConfig,
        enabled: editEnabled,
      });
      setEditTarget(null);
      await loadInputs();
      await reloadApps();
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
          : `Recording started for "${input.name}" — appears in Recordings when the stream stops`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const handleCreateInput = async () => {
    if (!inputModal || !canSubmitInputForm(inputForm)) return;
    setInputSubmitting(true);
    setInputSubmitError(null);
    try {
      await api.createInput({
        applicationId: inputModal.applicationId,
        name: inputForm.name.trim(),
        streamKey: resolveInputStreamKey(
          inputForm.name,
          inputForm.ingestProtocol,
          inputForm.streamKey
        ),
        ingestProtocol: inputForm.ingestProtocol,
        protocolConfig: inputForm.protocolConfig,
        enabled: true,
      });
      setInputModal(null);
      await loadInputs();
      await reloadApps();
    } catch (err) {
      setInputSubmitError(errorMessage(err, 'Failed to create stream key'));
    } finally {
      setInputSubmitting(false);
    }
  };

  const appSlugPreview = appForm.appName.trim() || (appForm.name ? slugifyAppName(appForm.name) : '');

  return (
    <div>
      <PageHeader
        title="Inputs"
        description="Applications are events or venues (SRS app paths). Click a stream key row for settings."
        action={
          allowAppManagement ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={openAppModal}>
                + Add application
              </Button>
            </div>
          ) : undefined
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
        appName={editTarget?.appName ?? 'live'}
        form={editForm}
        enabled={editEnabled}
        submitError={editSubmitError}
        isSubmitting={editSubmitting}
        onClose={() => setEditTarget(null)}
        onChange={setEditForm}
        onEnabledChange={setEditEnabled}
        onSave={handleSaveEdit}
      />

      {appsError && <Alert>{appsError}</Alert>}

      {appsLoading || inputsLoading ? (
        <Card className="px-6 py-12 text-center hf-muted">Loading applications…</Card>
      ) : applications.length === 0 ? (
        <Card className="px-6 py-12 text-center hf-muted">
          <FolderOpen className="mx-auto mb-3 text-slate-500" size={40} />
          <p>No applications yet.</p>
          <p className="mt-2 text-sm">Create an application (e.g. a conference or venue), then add stream keys inside it.</p>
          <Button variant="primary" className="mt-4" onClick={openAppModal}>
            + Add application
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {applications.map((app) => {
            const inputs = inputsByApp.get(app.id) ?? [];
            const liveCount = applicationLiveCount(inputs, publishingIndex);
            return (
              <Card key={app.id} className="overflow-hidden border border-slate-700/40">
                <div className="px-6 py-4 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/inputs/applications/${app.id}`}
                      className="text-lg font-semibold text-slate-100 hover:text-brand-300 inline-flex items-center gap-2 flex-wrap"
                    >
                      {app.name}
                      {liveCount > 0 && <StreamLiveBadge />}
                      <ChevronRight size={18} className="text-slate-500" />
                    </Link>
                    <p className="font-mono text-xs text-brand-400/90 mt-1">
                      rtmp://…/{app.appName}/&lt;stream-key&gt;
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button variant="secondary" size="sm" onClick={() => openInputModal(app)}>
                      + Add stream key
                    </Button>
                    <DeleteButton
                      label={`Delete application ${app.name}`}
                      confirmTitle={`Delete application "${app.name}"?`}
                      confirmMessage={
                        inputs.length > 0
                          ? `Remove all stream keys in "${app.name}" before deleting the application.`
                          : 'This cannot be undone. All routes and settings for this application will be lost.'
                      }
                      disabled={inputs.length > 0}
                      onDelete={async () => {
                        await api.deleteApplication(app.id);
                        await reloadApps();
                        await loadInputs();
                      }}
                    />
                    <Link
                      to={`/inputs/applications/${app.id}`}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                    >
                      Open
                    </Link>
                  </div>
                </div>
                {inputs.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm hf-muted">
                    No stream keys in this application yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-800/60">
                    {inputs.map((input) => (
                      <ClickableRow
                        key={input.id}
                        as="li"
                        to={`/stream-keys/${input.id}`}
                        className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span className="text-slate-100 font-medium">{input.name}</span>
                          <span className="hf-muted">·</span>
                          <span className="font-mono text-slate-400">{input.streamKey}</span>
                          {isInputPublishing(input, publishingIndex) && <StreamLiveBadge />}
                        </div>
                        <RowActionsCell as="div" className="flex items-center gap-2">
                          <CopyableUrl
                            url={generateIngestUrl(
                              input.ingestProtocol,
                              input.streamKey,
                              input.protocolConfig,
                              app.appName
                            )}
                            className="text-xs max-w-md hidden lg:inline"
                            onCopied={notify}
                          />
                          <StreamKeyActions
                            input={input}
                            appName={app.appName}
                            isPublishing={isInputPublishing(input, publishingIndex)}
                            onPreview={() =>
                              openPreview({
                                streamKey: input.streamKey,
                                gatewayApp: app.appName,
                                label: input.name,
                                status: isInputPublishing(input, publishingIndex)
                                  ? 'publishing'
                                  : undefined,
                              })
                            }
                            onMonitor={() =>
                              openMonitor({
                                streamKey: input.streamKey,
                                gatewayApp: app.appName,
                                label: input.name,
                                status: 'publishing',
                              })
                            }
                            onNotify={notify}
                            onEdit={() => openEdit(input, app.appName)}
                            onRecord={() => handleRecord(input)}
                            onDeleted={async () => {
                              await loadInputs();
                              await reloadApps();
                            }}
                          />
                        </RowActionsCell>
                      </ClickableRow>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={appModalOpen} onClose={() => setAppModalOpen(false)} title="New application">
        <div className="space-y-4">
          <TextInput
            label="Display name"
            placeholder="Summer Conference 2026"
            value={appForm.name}
            onChange={(e) => setAppForm((f) => ({ ...f, name: e.target.value }))}
          />
          <TextInput
            label="Application slug (SRS path)"
            placeholder="summer-2026"
            value={appForm.appName}
            onChange={(e) => setAppForm((f) => ({ ...f, appName: e.target.value }))}
          />
          <p className="text-xs hf-muted -mt-2">Lowercase letters, numbers, hyphens — used in the RTMP URL.</p>
          {appSlugPreview && (
            <p className="text-xs font-mono text-brand-400/90">
              Publish pattern: rtmp://host:1935/{appSlugPreview}/&lt;stream-key&gt;
            </p>
          )}
          <TextInput
            label="Description (optional)"
            value={appForm.description}
            onChange={(e) => setAppForm((f) => ({ ...f, description: e.target.value }))}
          />
          <FormError message={appSubmitError} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAppModalOpen(false)} disabled={appSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateApp}
              disabled={!appForm.name.trim() || appSubmitting}
            >
              {appSubmitting ? 'Saving…' : 'Create application'}
            </Button>
          </div>
        </div>
      </Modal>

      {inputModal && (
        <Modal isOpen onClose={() => setInputModal(null)} title="New stream key">
          <p className="text-sm hf-muted mb-4">
            Application: <span className="font-mono text-brand-300">/{inputModal.appName}/</span>
          </p>
          <InputFormFields appName={inputModal.appName} form={inputForm} onChange={setInputForm} />
          <div className="mt-3">
            <FormError message={inputSubmitError} />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setInputModal(null)} disabled={inputSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateInput}
              disabled={!canSubmitInputForm(inputForm) || inputSubmitting}
            >
              {inputSubmitting ? 'Saving…' : 'Create stream key'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default InputsPage;
