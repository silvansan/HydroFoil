import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Card, PageHeader, TextInput, Button } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { Input, LiveSession, StreamProfile } from '../api/types';
import { formatStreamProfileOption } from '../lib/stream-profile';
import { Alert } from '../components/Alert';
import { CopyableUrl } from '../components/CopyableUrl';
import { DeleteButton } from '../components/DeleteButton';
import { SessionStatusBadge } from '../components/SessionStatusBadge';
import { StreamMediaActions } from '../components/StreamMediaActions';
import { useStreamMonitorModal } from '../hooks/useStreamMonitorModal';
import { isSessionPublishing } from '../lib/session-status';
import { ingestProtocolDisplayLabel, ingestUrlForInput } from '../lib/stream';

type TabId = 'settings' | 'sessions';

const StreamKeySettingsPage: React.FC = () => {
  const { inputId } = useParams<{ inputId: string }>();
  const [tab, setTab] = React.useState<TabId>('settings');
  const [input, setInput] = React.useState<Input | null>(null);
  const [sessions, setSessions] = React.useState<LiveSession[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    enabled: true,
    recordingPolicyIds: [] as string[],
    streamProfileIds: [] as string[],
    audioFeedProfileIds: [] as string[],
  });
  const [policies, setPolicies] = React.useState<Array<{ id: string; name: string }>>([]);
  const [streamProfiles, setStreamProfiles] = React.useState<StreamProfile[]>([]);
  const [audioFeeds, setAudioFeeds] = React.useState<Array<{ id: string; name: string }>>([]);
  const { openMonitor, monitorModal } = useStreamMonitorModal();

  const appName = input?.application?.appName ?? 'live';

  const load = React.useCallback(async () => {
    if (!inputId) return;
    setError(null);
    const [inputRes, sessionsRes] = await Promise.all([
      api.getInput(inputId),
      api.listInputSessions(inputId),
    ]);
    setInput(inputRes);
    setForm({
      name: inputRes.name,
      enabled: inputRes.enabled,
      recordingPolicyIds: inputRes.recordingPolicyIds ?? (inputRes.recordingPolicyId ? [inputRes.recordingPolicyId] : []),
      streamProfileIds: inputRes.streamProfileIds ?? (inputRes.streamProfileId ? [inputRes.streamProfileId] : []),
      audioFeedProfileIds: inputRes.audioFeedProfileIds ?? (inputRes.audioFeedProfileId ? [inputRes.audioFeedProfileId] : []),
    });
    setSessions(sessionsRes.items);
  }, [inputId]);

  React.useEffect(() => {
    Promise.all([
      api.listRecordingPolicies('attach'),
      api.listStreamProfiles(),
      api.listAudioFeedProfiles(),
    ]).then(([policyRes, streamRes, audioRes]) => {
      setPolicies(
        (policyRes.items as Array<{ id: string; name: string }>).map((p) => ({
          id: p.id,
          name: p.name,
        }))
      );
      setStreamProfiles(streamRes.items);
      setAudioFeeds(
        (audioRes.items as Array<{ id: string; name: string }>).map((p) => ({
          id: p.id,
          name: p.name,
        }))
      );
    });
  }, []);

  React.useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [load]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2000);
  };

  const handleSave = async () => {
    if (!input) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await api.updateInput(input.id, {
        name: form.name.trim(),
        enabled: form.enabled,
        recordingPolicyIds: form.recordingPolicyIds,
        streamProfileIds: form.streamProfileIds,
        audioFeedProfileIds: form.audioFeedProfileIds,
      });
      await load();
      notify('Stream key saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const activeSession = sessions.find((s) => isSessionPublishing(s.status));
  const isPublishing = Boolean(activeSession && isSessionPublishing(activeSession.status));

  const previewTarget = input
    ? {
        streamKey: input.streamKey,
        gatewayApp: appName,
        label: input.name,
        status: activeSession?.status,
      }
    : null;
  const toggleId = (field: 'recordingPolicyIds' | 'streamProfileIds' | 'audioFeedProfileIds', id: string) => {
    setForm((current) => {
      const values = current[field];
      return {
        ...current,
        [field]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id],
      };
    });
  };

  const renderPolicyList = (
    title: string,
    note: string,
    items: Array<{ id: string; name: string }>,
    field: 'recordingPolicyIds' | 'streamProfileIds' | 'audioFeedProfileIds'
  ) => (
    <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="text-xs hf-muted">{note}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm hf-muted">No templates configured.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-white/5">
              <input
                type="checkbox"
                checked={form[field].includes(item.id)}
                onChange={() => toggleId(field, item.id)}
                className="rounded border-slate-600 text-brand-500"
              />
              <span>{item.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  if (!input && !error) {
    return <div className="hf-muted py-12 text-center">Loading stream key…</div>;
  }

  return (
    <div className="space-y-6">
      <Link
        to="/live-sessions"
        className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300"
      >
        <ArrowLeft size={16} />
        Live streams
      </Link>

      <PageHeader
        title={input?.name ?? 'Stream key'}
        description={
          input ? (
            <span className="font-mono text-sm">{appName}/{input.streamKey}</span>
          ) : undefined
        }
        action={
          input ? (
            <StreamMediaActions
              target={{
                streamKey: input.streamKey,
                gatewayApp: appName,
                label: input.name,
                status: activeSession?.status,
              }}
              onPreview={() =>
                openMonitor({
                  streamKey: input.streamKey,
                  gatewayApp: appName,
                  label: input.name,
                  status: activeSession?.status,
                })
              }
              onMonitor={
                activeSession && isSessionPublishing(activeSession.status)
                  ? () =>
                      openMonitor({
                        streamKey: input.streamKey,
                        gatewayApp: appName,
                        label: input.name,
                        status: activeSession.status,
                      })
                  : undefined
              }
              onNotify={notify}
            />
          ) : undefined
        }
      />

      {monitorModal}
      {error && <Alert>{error}</Alert>}
      {saveError && <Alert>{saveError}</Alert>}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {input && (
        <>
          <div className="flex gap-2 border-b border-slate-700/50">
            <button
              type="button"
              onClick={() => setTab('settings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'settings'
                  ? 'border-brand-400 text-brand-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setTab('sessions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'sessions'
                  ? 'border-brand-400 text-brand-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Session log
              {sessions.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">({sessions.length})</span>
              )}
            </button>
          </div>

          {tab === 'settings' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-100">Ingest</h2>
                <TextInput
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <div>
                  <label className="text-sm font-medium text-slate-300">Stream key</label>
                  <p className="mt-1 font-mono text-sm text-brand-400">{input.streamKey}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300">
                    {ingestProtocolDisplayLabel(input.ingestProtocol)}
                  </label>
                  <CopyableUrl
                    url={ingestUrlForInput(input, appName)}
                    className="mt-1 text-xs break-all max-w-full"
                    onCopied={notify}
                  />
                  <p className="mt-1 text-xs hf-muted">
                    Protocol: {input.ingestProtocol.toUpperCase()} — only this ingest URL is active for
                    this input.
                  </p>
                </div>
                {previewTarget && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button
                      variant="primary"
                      onClick={() =>
                        openMonitor({
                          streamKey: input.streamKey,
                          gatewayApp: appName,
                          label: input.name,
                          status: activeSession?.status ?? 'publishing',
                        })
                      }
                      disabled={!isPublishing}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Play size={16} className="fill-current" aria-hidden />
                        Play
                      </span>
                    </Button>
                    {!isPublishing && (
                      <p className="text-xs hf-muted w-full">
                        Start publishing to this ingest URL to play the stream here.
                      </p>
                    )}
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-slate-600 text-brand-500"
                  />
                  Input enabled
                </label>
                <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving…' : 'Save'}
                </Button>
                {input.application && (
                  <p className="text-xs hf-muted">
                    Application:{' '}
                    <Link
                      to={`/inputs/applications/${input.applicationId}`}
                      className="text-brand-400 hover:underline"
                    >
                      {input.application.name}
                    </Link>
                  </p>
                )}
              </Card>

              <Card className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-slate-100">Policies</h2>
                {renderPolicyList(
                  'Recording policies',
                  'Select one or more destinations/retention rules for this stream key.',
                  policies,
                  'recordingPolicyIds'
                )}
                <div className="rounded-lg border border-slate-700/70 bg-slate-950/30 p-3">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-200">Stream profiles / transcodes</h3>
                    <p className="text-xs hf-muted">
                      Select one or more profiles. Renditions merge into gateway desired config.{' '}
                      <Link to="/stream-profiles" className="hf-link hover:underline">
                        Manage profiles
                      </Link>
                    </p>
                  </div>
                  {streamProfiles.length === 0 ? (
                    <p className="text-sm hf-muted">No stream profiles yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {streamProfiles.map((profile) => (
                        <label
                          key={profile.id}
                          className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={form.streamProfileIds.includes(profile.id)}
                            onChange={() => toggleId('streamProfileIds', profile.id)}
                            className="mt-1 rounded border-slate-600 text-brand-500"
                          />
                          <span className="min-w-0 flex-1">
                            <Link
                              to={`/stream-profiles/${profile.id}`}
                              className="font-medium text-slate-100 hf-link hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {profile.name}
                            </Link>
                            <span className="block text-xs hf-muted mt-0.5">
                              {formatStreamProfileOption(profile)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {renderPolicyList(
                  'Audio feed profiles',
                  'MP3/AAC/Opus derivatives. With recording enabled, audio is extracted after finalize; otherwise from DVR when the stream ends.',
                  audioFeeds,
                  'audioFeedProfileIds'
                )}
                <p className="text-xs hf-muted">
                  Manage templates under{' '}
                  <Link to="/recording-policies" className="text-brand-400 hover:underline">
                    Recording Policies
                  </Link>
                  ,{' '}

                  ,{' '}
                  <Link to="/audio-feed-profiles" className="text-brand-400 hover:underline">
                    Audio Feeds
                  </Link>
                  .
                </p>
              </Card>
            </div>
          )}

          {tab === 'sessions' && (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/50">
                <h2 className="text-lg font-semibold text-slate-100">Session log</h2>
                <p className="text-sm hf-muted mt-1">
                  Publish history for this stream key. Idle rows are ended sessions — remove them
                  to tidy the log.
                </p>
              </div>
              {sessions.length === 0 ? (
                <div className="px-6 py-10 text-center hf-muted text-sm">No sessions recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/40">
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Started</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Ended</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => {
                        const publishing = isSessionPublishing(session.status);
                        return (
                          <tr key={session.id} className="border-b border-slate-800/50">
                            <td className="px-4 py-3">
                              <SessionStatusBadge status={session.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {session.startedAt
                                ? new Date(session.startedAt).toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400">
                              {session.endedAt
                                ? new Date(session.endedAt).toLocaleString()
                                : publishing
                                  ? '—'
                                  : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {publishing && (
                                  <StreamMediaActions
                                    target={{
                                      streamKey: input.streamKey,
                                      gatewayApp: session.gatewayApp ?? appName,
                                      label: input.name,
                                      status: session.status,
                                    }}
                                    onPreview={() =>
                                      openMonitor({
                                        streamKey: input.streamKey,
                                        gatewayApp: session.gatewayApp ?? appName,
                                        label: input.name,
                                        status: session.status,
                                      })
                                    }
                                    onMonitor={() =>
                                      openMonitor({
                                        streamKey: input.streamKey,
                                        gatewayApp: session.gatewayApp ?? appName,
                                        label: input.name,
                                        status: session.status,
                                      })
                                    }
                                    onNotify={notify}
                                  />
                                )}
                                <DeleteButton
                                  label="Remove"
                                  confirmTitle="Remove session record?"
                                  confirmMessage={
                                    publishing
                                      ? 'Stop the encoder before removing an active session.'
                                      : 'Remove this ended session from the log?'
                                  }
                                  disabled={publishing}
                                  onDelete={async () => {
                                    await api.deleteLiveSession(session.id);
                                    await load();
                                  }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default StreamKeySettingsPage;
