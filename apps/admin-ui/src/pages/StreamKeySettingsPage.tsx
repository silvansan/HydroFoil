import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play } from 'lucide-react';
import { Card, PageHeader, TextInput, Button } from '@hydrofoil/ui-kit';

import { api } from '../api/client';
import type { DomainBlock, Input, LiveSession, StreamProfile } from '../api/types';
import { InputPlaybackShareCard } from '../components/InputPlaybackShareCard';
import { useInputPlaybackShare } from '../hooks/useInputPlaybackShare';
import {
  STREAM_KEY_PRIVACY_PRESETS,
  parseAllowedDomains,
  presetFromDomainBlock,
  streamKeyPrivacyFormErrors,
  type StreamKeyPrivacyPreset,
} from '../lib/privacy-policy';
import { formatStreamProfileOption } from '../lib/stream-profile';
import { Alert } from '../components/Alert';
import { CopyableUrl } from '../components/CopyableUrl';
import { PolicySection } from '../components/PolicySection';
import { SelectablePolicyCard } from '../components/SelectablePolicyCard';
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
    domainBlockId: '' as string,
    privacyPreset: 'public' as StreamKeyPrivacyPreset,
    allowedDomains: '',
    limitDomains: false,
  });
  const [privacyValidation, setPrivacyValidation] = React.useState(false);
  const [policies, setPolicies] = React.useState<Array<{ id: string; name: string }>>([]);
  const [domainBlocks, setDomainBlocks] = React.useState<DomainBlock[]>([]);
  const [streamProfiles, setStreamProfiles] = React.useState<StreamProfile[]>([]);
  const [audioFeeds, setAudioFeeds] = React.useState<Array<{ id: string; name: string }>>([]);
  const { openMonitor, monitorModal } = useStreamMonitorModal();
  const {
    share: playbackShare,
    loading: playbackShareLoading,
    error: playbackShareError,
    reload: reloadPlaybackShare,
  } = useInputPlaybackShare(input?.id);

  const appName = input?.application?.appName ?? 'live';

  const load = React.useCallback(async () => {
    if (!inputId) return;
    setError(null);
    const [inputRes, sessionsRes] = await Promise.all([
      api.getInput(inputId),
      api.listInputSessions(inputId),
    ]);
    setInput(inputRes);
    setForm((current) => ({
      ...current,
      name: inputRes.name,
      enabled: inputRes.enabled,
      recordingPolicyIds:
        inputRes.recordingPolicyIds ??
        (inputRes.recordingPolicyId ? [inputRes.recordingPolicyId] : []),
      streamProfileIds:
        inputRes.streamProfileIds ??
        (inputRes.streamProfileId ? [inputRes.streamProfileId] : []),
      audioFeedProfileIds:
        inputRes.audioFeedProfileIds ??
        (inputRes.audioFeedProfileId ? [inputRes.audioFeedProfileId] : []),
    }));
    setSessions(sessionsRes.items);
    try {
      const share = await api.getInputPlaybackUrl(inputId);
      const block = share.domainBlockId
        ? (await api.getDomainBlock(share.domainBlockId).catch(() => null))
        : null;
      setForm((current) => ({
        ...current,
        domainBlockId: share.domainBlockId ?? '',
        privacyPreset: share.domainBlockId
          ? presetFromDomainBlock(block ?? undefined)
          : 'public',
        allowedDomains: share.domainBlockId ? (block?.allowedDomains ?? []).join('\n') : '',
        limitDomains: Boolean(
          block?.playbackAccessPolicy === 'token-required' && (block.allowedDomains?.length ?? 0) > 0
        ),
      }));
    } catch {
      /* playback-url optional during load */
    }
  }, [inputId]);

  React.useEffect(() => {
    Promise.all([
      api.listRecordingPolicies('attach'),
      api.listStreamProfiles(),
      api.listAudioFeedProfiles(),
      api.listDomainBlocks(),
    ]).then(([policyRes, streamRes, audioRes, domainRes]) => {
      setDomainBlocks(domainRes.items);
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
    setPrivacyValidation(true);
    const privacyErrors = streamKeyPrivacyFormErrors({
      privacyPreset: form.privacyPreset,
      allowedDomains: form.allowedDomains,
      limitDomains: form.limitDomains,
    });
    if (Object.keys(privacyErrors).length > 0) {
      setSaveError('Fix privacy settings before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      let domainBlockId: string | null = null;
      if (form.privacyPreset !== 'public') {
        const domains =
          form.privacyPreset === 'restricted' || form.limitDomains
            ? parseAllowedDomains(form.allowedDomains)
            : [];
        const existing = form.domainBlockId
          ? domainBlocks.find((block) => block.id === form.domainBlockId)
          : undefined;
        if (existing && existing.playbackAccessPolicy === form.privacyPreset) {
          await api.updateDomainBlock(existing.id, {
            allowedDomains: domains,
            playbackAccessPolicy: form.privacyPreset,
            tokenRequired: form.privacyPreset === 'token-required',
          });
          domainBlockId = existing.id;
        } else {
          const block = await api.createDomainBlock({
            name: `${form.name.trim() || input.name} playback`,
            allowedDomains: domains,
            playbackAccessPolicy: form.privacyPreset,
            tokenRequired: form.privacyPreset === 'token-required',
          });
          domainBlockId = block.id;
          setDomainBlocks((items) => [...items, block]);
        }
      }

      await api.updateInput(input.id, {
        name: form.name.trim(),
        enabled: form.enabled,
        recordingPolicyIds: form.recordingPolicyIds,
        streamProfileIds: form.streamProfileIds,
        audioFeedProfileIds: form.audioFeedProfileIds,
        domainBlockId,
      });
      if (form.privacyPreset === 'public') {
        setForm((current) => ({
          ...current,
          domainBlockId: '',
          privacyPreset: 'public',
          allowedDomains: '',
          limitDomains: false,
        }));
      }
      await load();
      reloadPlaybackShare();
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
    field: 'recordingPolicyIds' | 'streamProfileIds' | 'audioFeedProfileIds',
    emptyMessage = 'No templates configured.'
  ) => (
    <PolicySection title={title} description={note} isEmpty={items.length === 0} emptyMessage={emptyMessage}>
      <div className="space-y-2">
        {items.map((item) => (
          <SelectablePolicyCard
            key={item.id}
            selected={form[field].includes(item.id)}
            onToggle={() => toggleId(field, item.id)}
            title={item.name}
          />
        ))}
      </div>
    </PolicySection>
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
              inputId={input.id}
              target={{
                streamKey: input.streamKey,
                gatewayApp: appName,
                label: input.name,
                status: isPublishing ? 'publishing' : activeSession?.status,
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
                    {ingestProtocolDisplayLabel(input.ingestProtocol, ingestUrlForInput(input, appName))}
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
                <PolicySection
                  title="Stream profiles / transcodes"
                  description={
                    <>
                      Select one or more profiles. Renditions merge into gateway desired config.{' '}
                      <Link to="/stream-profiles" className="hf-link hover:underline">
                        Manage profiles
                      </Link>
                    </>
                  }
                  isEmpty={streamProfiles.length === 0}
                  emptyMessage="No stream profiles yet."
                >
                  <div className="space-y-2">
                    {streamProfiles.map((profile) => (
                      <SelectablePolicyCard
                        key={profile.id}
                        selected={form.streamProfileIds.includes(profile.id)}
                        onToggle={() => toggleId('streamProfileIds', profile.id)}
                        title={
                          <Link
                            to={`/stream-profiles/${profile.id}`}
                            className="hf-link hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {profile.name}
                          </Link>
                        }
                        description={formatStreamProfileOption(profile)}
                      />
                    ))}
                  </div>
                </PolicySection>
                {renderPolicyList(
                  'Audio feed profiles',
                  'MP3/AAC/Opus derivatives. With recording enabled, audio is extracted after finalize; otherwise from DVR when the stream ends.',
                  audioFeeds,
                  'audioFeedProfileIds'
                )}
                <PolicySection
                  title="Privacy / playback access"
                  description="Choose how partners embed this stream. Signed links appear under Web playback after you save."
                  isEmpty={false}
                >
                  <div className="space-y-2">
                    {STREAM_KEY_PRIVACY_PRESETS.map((preset) => (
                      <SelectablePolicyCard
                        key={preset.value}
                        selected={form.privacyPreset === preset.value}
                        onToggle={() =>
                          setForm((current) => ({
                            ...current,
                            privacyPreset: preset.value,
                            limitDomains:
                              preset.value === 'token-required' ? current.limitDomains : false,
                          }))
                        }
                        title={preset.title}
                        description={preset.description}
                      />
                    ))}
                  </div>
                  {form.privacyPreset === 'token-required' && (
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.limitDomains}
                        onChange={(e) =>
                          setForm((current) => ({ ...current, limitDomains: e.target.checked }))
                        }
                        className="rounded border-slate-600 text-brand-500"
                      />
                      Also limit to these domains
                    </label>
                  )}
                  {(form.privacyPreset === 'restricted' ||
                    (form.privacyPreset === 'token-required' && form.limitDomains)) && (
                    <div>
                      <label className="text-xs font-medium text-slate-400">Allowed domains</label>
                      <textarea
                        className="hf-input mt-1 min-h-[5rem] font-mono text-xs"
                        placeholder="yoursite.com&#10;*.partner.org"
                        value={form.allowedDomains}
                        onChange={(e) =>
                          setForm((current) => ({ ...current, allowedDomains: e.target.value }))
                        }
                      />
                      {privacyValidation &&
                        streamKeyPrivacyFormErrors({
                          privacyPreset: form.privacyPreset,
                          allowedDomains: form.allowedDomains,
                          limitDomains: form.limitDomains,
                        }).allowedDomains && (
                          <p className="mt-1 text-xs text-red-400">
                            {
                              streamKeyPrivacyFormErrors({
                                privacyPreset: form.privacyPreset,
                                allowedDomains: form.allowedDomains,
                                limitDomains: form.limitDomains,
                              }).allowedDomains
                            }
                          </p>
                        )}
                    </div>
                  )}
                  <p className="text-xs hf-muted">
                    <Link to="/domain-blocks" className="text-brand-400 hover:underline">
                      Manage reusable privacy policies
                    </Link>
                  </p>
                </PolicySection>
                <p className="text-xs hf-muted">
                  Manage templates under{' '}
                  <Link to="/recording-policies" className="text-brand-400 hover:underline">
                    Recording Policies
                  </Link>
                  ,{' '}
                  <Link to="/stream-profiles" className="text-brand-400 hover:underline">
                    Stream Profiles
                  </Link>
                  , and{' '}
                  <Link to="/audio-feed-profiles" className="text-brand-400 hover:underline">
                    Audio Feeds
                  </Link>
                  .
                </p>
              </Card>

              <Card className="p-6 space-y-4 lg:col-span-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Web playback</h2>
                  <p className="mt-1 text-sm hf-muted">
                    HLS and embed links for your website — includes signed tokens when a privacy
                    policy requires them. Quality options appear in the player when ABR transcode
                    renditions are live.
                  </p>
                </div>
                <InputPlaybackShareCard
                  share={playbackShare}
                  loading={playbackShareLoading}
                  error={playbackShareError}
                  onCopied={notify}
                  onRegenerate={(options) => reloadPlaybackShare(options) ?? Promise.resolve()}
                />
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
                                    inputId={input.id}
                                    target={{
                                      streamKey: input.streamKey,
                                      gatewayApp: session.gatewayApp ?? appName,
                                      label: input.name,
                                      status: 'publishing',
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
