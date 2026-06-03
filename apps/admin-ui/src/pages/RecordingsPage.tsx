import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, PageHeader } from '@hydrofoil/ui-kit';
import { Download, FolderKanban, Pencil, Play, Plus, RefreshCw, Search } from 'lucide-react';

import { api } from '../api/client';
import type { DvrWatchlistEntry, RecordingAsset } from '../api/types';
import { Alert } from '../components/Alert';
import { ClickableRow, RowActionsCell } from '../components/ClickableRow';
import { DeleteButton } from '../components/DeleteButton';
import { DvrWatchlistEntryForm } from '../components/DvrWatchlistEntryForm';
import { IconActionButton } from '../components/IconActionButton';
import { RecordingManagementLinkCard } from '../components/RecordingManagementLinkCard';
import { RecordingStatusBadge } from '../components/RecordingStatusBadge';
import { useResourceList } from '../hooks/useResourceList';
import { useRecordingPreviewModal } from '../hooks/useRecordingPreviewModal';
import {
  describePlaybackFormats,
  describeRecordingStatus,
  filterRecordings,
  formatRecordingBytes,
  formatRecordingDuration,
  recordingStatusCounts,
  type RecordingStatusFilter,
} from '../lib/recording-management';

const STATUS_FILTERS: Array<{ id: RecordingStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'finalizing', label: 'Finalizing' },
  { id: 'recording', label: 'Recording' },
  { id: 'failed', label: 'Failed' },
];

const RecordingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, isLoading, error, reload } = useResourceList<RecordingAsset>(() =>
    api.listRecordings()
  );
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<RecordingStatusFilter>('all');
  const [watchlistEntries, setWatchlistEntries] = React.useState<DvrWatchlistEntry[]>([]);
  const [watchlistLoading, setWatchlistLoading] = React.useState(true);
  const [watchlistError, setWatchlistError] = React.useState<string | null>(null);
  const [showWatchlist, setShowWatchlist] = React.useState(false);
  const [showAddWatchlistModal, setShowAddWatchlistModal] = React.useState(false);
  const [editingWatchlistEntry, setEditingWatchlistEntry] = React.useState<DvrWatchlistEntry | null>(
    null
  );
  const { openRecordingPreview, previewModal } = useRecordingPreviewModal();
  const [toast, setToast] = React.useState<string | null>(null);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const counts = React.useMemo(() => recordingStatusCounts(items), [items]);
  const filteredItems = React.useMemo(
    () => filterRecordings(items, { search, status: statusFilter }),
    [items, search, statusFilter]
  );

  const loadWatchlist = React.useCallback(async () => {
    setWatchlistLoading(true);
    setWatchlistError(null);
    try {
      const result = await api.listDvrWatchlist();
      setWatchlistEntries(result.items ?? []);
    } catch (err) {
      setWatchlistError(err instanceof Error ? err.message : 'Failed to load DVR watchlist');
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadWatchlist();
  }, [loadWatchlist]);

  const handleSavedWatchlistEntry = (entry: DvrWatchlistEntry) => {
    setWatchlistEntries((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === entry.id);
      if (existingIndex === -1) return [entry, ...prev];
      return prev.map((item) => (item.id === entry.id ? entry : item));
    });
  };

  const openPreview = (recording: RecordingAsset) => {
    if (recording.status !== 'ready') {
      const hint = describeRecordingStatus(recording.status).hint;
      notify(hint ?? 'Recording is not ready for playback yet.');
      return;
    }
    openRecordingPreview({
      id: recording.id,
      label: recording.inputName ?? recording.streamKey ?? recording.objectKey,
    });
  };

  const downloadRecording = async (recording: RecordingAsset) => {
    if (recording.status !== 'ready') {
      notify('Only ready recordings can be downloaded.');
      return;
    }
    try {
      const playback = await api.getRecordingPlaybackUrl(recording.id);
      window.open(playback.shareUrl || playback.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to fetch download link');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recordings"
        description="Browse finalized DVR assets, preview playback, and manage legacy SRS watchlist capture rules."
        action={
          <Button variant="secondary" onClick={() => void reload()} disabled={isLoading}>
            <RefreshCw size={16} className="mr-1.5 inline" aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      <RecordingManagementLinkCard
        readyCount={counts.ready}
        inProgressCount={counts.finalizing + counts.recording}
      />

      <Card className="overflow-hidden">
        <div className="border-b border-slate-700/50 px-6 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Recorded assets</h2>
            <p className="mt-1 text-sm hf-muted">
              {items.length} in catalog — open a row for playback, derivatives, and storage details.
            </p>
          </div>
          {items.length > 0 && (
            <div className="relative w-full lg:max-w-xs">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                aria-hidden
              />
              <input
                type="search"
                className="hf-input pl-9"
                placeholder="Search stream, app, policy…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search recordings"
              />
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-slate-800/60 px-6 py-3">
            {STATUS_FILTERS.map((filter) => {
              const count = counts[filter.id];
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === filter.id
                      ? 'bg-brand-600/20 text-brand-300 border border-brand-500/40'
                      : 'border border-slate-700/80 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {filter.label}
                  <span className="ml-1 opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <div className="px-6 py-12 text-center hf-muted">Loading recordings…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center max-w-md mx-auto">
            <p className="text-slate-200">No recordings yet</p>
            <p className="mt-2 text-sm hf-muted">
              Assign a recording policy on a stream key, publish live, then stop the encoder. Assets
              appear here after finalize completes.
            </p>
            <Link to="/inputs">
              <Button variant="primary" className="mt-6">
                Go to stream keys
              </Button>
            </Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-6 py-12 text-center hf-muted">
            No recordings match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Stream</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Policy</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Duration</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Size</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Playback</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((recording) => (
                  <ClickableRow key={recording.id} to={`/recordings/${recording.id}`}>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-100">
                        {recording.inputName ?? recording.streamKey ?? '—'}
                      </div>
                      <div className="text-xs hf-muted">
                        {recording.applicationName ?? '—'}
                        {recording.streamKey ? (
                          <span className="font-mono"> · {recording.streamKey}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RecordingStatusBadge status={recording.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {recording.recordingPolicyName ? (
                        <Link
                          to={`/recording-policies/${recording.recordingPolicyId}`}
                          className="hf-link hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {recording.recordingPolicyName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {formatRecordingDuration(Number(recording.duration))}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {formatRecordingBytes(Number(recording.fileSize))}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {recording.status === 'ready'
                        ? describePlaybackFormats(recording)
                        : '—'}
                    </td>
                    <RowActionsCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconActionButton
                          label="Open application"
                          icon={FolderKanban}
                          onClick={() => {
                            if (!recording.applicationId) {
                              notify('Not linked to an application.');
                              return;
                            }
                            navigate(`/inputs/applications/${recording.applicationId}`);
                          }}
                          disabled={!recording.applicationId}
                        />
                        <IconActionButton
                          label="Stream key settings"
                          icon={Pencil}
                          onClick={() => {
                            if (!recording.inputId) {
                              notify('Not linked to a stream key.');
                              return;
                            }
                            navigate(`/stream-keys/${recording.inputId}`);
                          }}
                          disabled={!recording.inputId}
                        />
                        <IconActionButton
                          label="Preview"
                          icon={Play}
                          onClick={() => openPreview(recording)}
                          disabled={recording.status !== 'ready'}
                          iconFill={recording.status === 'ready' ? 'currentColor' : undefined}
                        />
                        <IconActionButton
                          label="Download"
                          icon={Download}
                          onClick={() => void downloadRecording(recording)}
                          disabled={recording.status !== 'ready'}
                        />
                        <DeleteButton
                          label="Delete recording"
                          confirmTitle="Delete recording?"
                          confirmMessage={`Remove "${recording.objectKey}" from the catalog and delete media from storage?`}
                          onDelete={async () => {
                            await api.deleteRecording(recording.id);
                            await reload();
                          }}
                        />
                      </div>
                    </RowActionsCell>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-700/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">SRS DVR watchlist</h2>
            <p className="text-sm hf-muted">
              Legacy application-level capture rules (separate from per-stream recording policies).
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowWatchlist((v) => !v)}>
              {showWatchlist ? 'Hide' : 'Show'} ({watchlistEntries.length})
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setEditingWatchlistEntry(null);
                setShowAddWatchlistModal(true);
                setShowWatchlist(true);
              }}
            >
              Add entry
            </Button>
          </div>
        </div>
        {showWatchlist &&
          (watchlistLoading ? (
            <div className="px-6 py-10 text-center hf-muted">Loading watchlist…</div>
          ) : watchlistError ? (
            <div className="px-6 py-10 text-center text-rose-300">{watchlistError}</div>
          ) : watchlistEntries.length === 0 ? (
            <div className="px-6 py-10 text-center hf-muted">No watchlist entries.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/40">
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Application
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Pattern
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Retention
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">
                      Storage
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-800/50">
                      <td className="px-4 py-3 text-sm text-slate-200">{entry.applicationName}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{entry.streamPattern}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{entry.retentionHours}h</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {entry.storageLocationName ?? entry.storageLocationId}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => {
                              setEditingWatchlistEntry(entry);
                              setShowAddWatchlistModal(true);
                            }}
                            className="rounded-lg p-2 text-brand-400 hover:bg-brand-500/20 hover:text-brand-300"
                          >
                            <Pencil size={17} />
                          </button>
                          <DeleteButton
                            label="Delete watchlist entry"
                            confirmTitle="Remove watchlist entry?"
                            confirmMessage={`Remove DVR watchlist for ${entry.applicationName}?`}
                            onDelete={async () => {
                              await api.deleteDvrWatchlistEntry(entry.id);
                              setWatchlistEntries((prev) =>
                                prev.filter((row) => row.id !== entry.id)
                              );
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </Card>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      {previewModal}
      <DvrWatchlistEntryForm
        isOpen={showAddWatchlistModal}
        onClose={() => {
          setShowAddWatchlistModal(false);
          setEditingWatchlistEntry(null);
        }}
        onSaved={handleSavedWatchlistEntry}
        entry={editingWatchlistEntry ?? undefined}
      />
    </div>
  );
};

export default RecordingsPage;
