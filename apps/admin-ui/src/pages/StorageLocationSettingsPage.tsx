import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Modal, TextInput } from '@hydrofoil/ui-kit';
import {
  Copy,
  Download,
  Edit3,
  File,
  Folder,
  FolderPlus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';

import { api } from '../api/client';
import type { RecordingPolicy, StorageLocation } from '../api/types';
import { Alert } from '../components/Alert';
import { ResourceSettingsLayout } from '../components/ResourceSettingsLayout';
import { errorMessage } from '../lib/api-error';

type StorageObject = {
  key: string;
  type?: 'object' | 'prefix';
  size: number;
  lastModified: string;
};

type DialogState =
  | { type: 'create-folder' }
  | { type: 'rename'; item: StorageObject }
  | { type: 'delete'; item: StorageObject }
  | null;

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function parentPrefix(prefix: string): string {
  const clean = trimSlashes(prefix);
  if (!clean) return '';
  const parts = clean.split('/');
  parts.pop();
  return parts.join('/');
}

function basename(key: string): string {
  const clean = trimSlashes(key);
  return clean.split('/').filter(Boolean).pop() ?? clean;
}

function joinKey(prefix: string, name: string): string {
  const cleanPrefix = trimSlashes(prefix);
  const cleanName = name.replace(/^\/+/, '');
  return [cleanPrefix, cleanName].filter(Boolean).join('/');
}

function ensureFolderKey(prefix: string): string {
  const clean = trimSlashes(prefix);
  return clean ? `${clean}/` : '';
}

function isLikelyPreviewable(key: string): boolean {
  return /\.(aac|flv|gif|jpe?g|m3u8|mp3|mp4|ogg|png|webp)$/i.test(key);
}

const iconClassName = 'h-4 w-4';

const StorageLocationSettingsPage: React.FC = () => {
  const { locationId } = useParams<{ locationId: string }>();
  const [location, setLocation] = React.useState<StorageLocation | null>(null);
  const [linkedPolicies, setLinkedPolicies] = React.useState<RecordingPolicy[]>([]);
  const [objects, setObjects] = React.useState<StorageObject[]>([]);
  const [currentPrefix, setCurrentPrefix] = React.useState('');
  const [resolvedPrefix, setResolvedPrefix] = React.useState('');
  const [manualPrefix, setManualPrefix] = React.useState('');
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [dialogValue, setDialogValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isLoadingObjects, setIsLoadingObjects] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadObjects = React.useCallback(
    async (prefix = currentPrefix) => {
      if (!locationId) return;
      setIsLoadingObjects(true);
      setError(null);
      try {
        const res = await api.listStorageObjects(locationId, trimSlashes(prefix) || undefined);
        setObjects(res.items);
        setResolvedPrefix(res.prefix);
        setCurrentPrefix(res.prefix);
        setManualPrefix(res.prefix);
        setSelectedKeys(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to list objects');
      } finally {
        setIsLoadingObjects(false);
      }
    },
    [currentPrefix, locationId]
  );

  React.useEffect(() => {
    if (!locationId) return;
    Promise.all([
      api.getStorageLocation(locationId),
      api.listRecordingPolicies('manage'),
    ])
      .then(([loc, policies]) => {
        setLocation(loc);
        setLinkedPolicies(policies.items.filter((p) => p.storageLocationId === locationId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [locationId]);

  React.useEffect(() => {
    if (locationId && location) {
      loadObjects('').catch(() => undefined);
    }
  }, [locationId, location]);

  const selectedItems = React.useMemo(
    () => objects.filter((item) => selectedKeys.has(item.key)),
    [objects, selectedKeys]
  );

  const openCreateFolder = () => {
    setDialogValue('');
    setDialog({ type: 'create-folder' });
  };

  const openRename = (item: StorageObject) => {
    setDialogValue(basename(item.key));
    setDialog({ type: 'rename', item });
  };

  const openDelete = (item: StorageObject) => {
    setDialogValue('');
    setDialog({ type: 'delete', item });
  };

  const closeDialog = () => {
    setDialog(null);
    setDialogValue('');
  };

  const handleCreateFolder = async () => {
    if (!locationId) return;
    const name = trimSlashes(dialogValue);
    if (!name) return;
    setError(null);
    await api.createStorageFolder(locationId, ensureFolderKey(joinKey(currentPrefix, name)));
    setNotice(`Folder "${name}" created.`);
    closeDialog();
    await loadObjects();
  };

  const handleRename = async () => {
    if (!locationId || dialog?.type !== 'rename') return;
    const name = trimSlashes(dialogValue);
    if (!name) return;

    const item = dialog.item;
    const destinationBase = joinKey(parentPrefix(item.key), name);
    setError(null);
    if (item.type === 'prefix') {
      await api.moveStorageFolder(locationId, item.key, ensureFolderKey(destinationBase));
    } else {
      await api.moveStorageObject(locationId, item.key, destinationBase);
    }
    setNotice(`Renamed "${basename(item.key)}" to "${name}".`);
    closeDialog();
    await loadObjects();
  };

  const handleDelete = async () => {
    if (!locationId || dialog?.type !== 'delete') return;
    const item = dialog.item;
    setError(null);
    setNotice(null);
    try {
      if (item.type === 'prefix') {
        const result = await api.deleteStorageFolder(locationId, item.key);
        const label = basename(item.key);
        setNotice(
          result.deleted > 1
            ? `Deleted folder "${label}" and ${result.deleted - 1} object(s) inside it.`
            : `Deleted folder "${label}".`
        );
      } else {
        await api.deleteStorageObject(locationId, item.key);
        setNotice(`Deleted "${basename(item.key)}".`);
      }
      closeDialog();
      await loadObjects();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete'));
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!locationId || !files || files.length === 0) return;
    setError(null);
    setNotice(null);
    try {
      for (const file of Array.from(files)) {
        const objectKey = joinKey(currentPrefix, file.name);
        const upload = await api.createStorageUploadUrl(locationId, objectKey);
        const response = await fetch(upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name} (${response.status})`);
        }
      }
      setNotice(`Uploaded ${files.length} file(s).`);
      await loadObjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (item: StorageObject) => {
    if (!locationId || item.type === 'prefix') return;
    const signed = await api.signStorageObject(locationId, item.key);
    window.open(signed.url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async (item: StorageObject) => {
    if (!locationId || item.type === 'prefix') return;
    const signed = await api.signStorageObject(locationId, item.key);
    await navigator.clipboard.writeText(signed.url);
    setNotice(`Signed VOD link copied for "${basename(item.key)}".`);
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedKeys((current) => {
      if (current.size === objects.length) return new Set();
      return new Set(objects.map((item) => item.key));
    });
  };

  const navigateTo = (prefix: string) => {
    loadObjects(prefix).catch(() => undefined);
  };

  const crumbs = resolvedPrefix ? trimSlashes(resolvedPrefix).split('/').filter(Boolean) : [];

  return (
    <ResourceSettingsLayout
      backTo="/storage"
      backLabel="All storage locations"
      title={String(location?.name ?? 'Storage location')}
      description="Browse files and manage DVR folders — recording policies write under prefixes here"
    >
      {error && <Alert>{error}</Alert>}
      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {location && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,280px)]">
          <Card className="p-6">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="hf-muted">Type</dt>
                <dd className="text-slate-200">{String(location.type ?? '-')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Bucket</dt>
                <dd className="font-mono text-slate-200">{String(location.bucketName ?? '-')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Endpoint</dt>
                <dd className="font-mono text-slate-200">{String(location.endpoint ?? 'env default')}</dd>
              </div>
              <div>
                <dt className="hf-muted">Root prefix</dt>
                <dd className="font-mono text-slate-200">{String(location.prefixPath ?? '-')}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Recording policies</h2>
            {linkedPolicies.length === 0 ? (
              <p className="text-xs hf-muted">No DVR policies use this location yet.</p>
            ) : (
              <ul className="space-y-2">
                {linkedPolicies.map((policy) => (
                  <li key={policy.id}>
                    <Link
                      to={`/recording-policies/${policy.id}`}
                      className="text-sm hf-link hover:underline"
                    >
                      {policy.name}
                    </Link>
                    <span className="block font-mono text-xs text-slate-500">{policy.pathPrefix}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to={`/recording-policies?storage=${locationId}`}
              className="text-xs hf-link hover:underline inline-block"
            >
              + Add recording policy
            </Link>
          </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-700/50 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Storage Explorer</h2>
                  <p className="mt-1 break-all font-mono text-xs hf-muted">
                    s3://{String(location.bucketName)}/{resolvedPrefix || ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={openCreateFolder}>
                    <span className="inline-flex items-center gap-2">
                      <FolderPlus className={iconClassName} /> New folder
                    </span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <span className="inline-flex items-center gap-2">
                      <Upload className={iconClassName} /> Upload files
                    </span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => loadObjects()}>
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className={iconClassName} /> Refresh
                    </span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => handleUploadFiles(event.target.files)}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  className="hf-breadcrumb-home"
                  onClick={() => navigateTo('')}
                >
                  Home
                </button>
                {crumbs.map((part, index) => {
                  const prefix = crumbs.slice(0, index + 1).join('/');
                  return (
                    <React.Fragment key={prefix}>
                      <span className="hf-muted">/</span>
                      <button
                        type="button"
                        className="hf-breadcrumb-segment"
                        onClick={() => navigateTo(prefix)}
                      >
                        {part}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs hf-muted">Jump to prefix</span>
                  <input
                    className="hf-input rounded-lg px-3 py-1.5 text-sm font-mono"
                    placeholder="media/recordings/mp4"
                    value={manualPrefix}
                    onChange={(e) => setManualPrefix(e.target.value)}
                  />
                </label>
                <Button size="sm" variant="secondary" onClick={() => navigateTo(manualPrefix)}>
                  Go
                </Button>
                <div className="ml-auto text-xs hf-muted">
                  Selected: {selectedKeys.size} of {objects.length}
                </div>
              </div>
            </div>

            {isLoadingObjects ? (
              <div className="px-6 py-10 text-center text-sm hf-muted">Loading objects...</div>
            ) : objects.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm hf-muted">
                No objects under this prefix. Upload files or create a folder to start organizing VOD assets.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/40">
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={objects.length > 0 && selectedKeys.size === objects.length}
                          onChange={toggleAll}
                          aria-label="Select all objects"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Size</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Modified</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map((obj) => {
                      const isFolder = obj.type === 'prefix';
                      return (
                        <tr key={obj.key} className="border-b border-slate-800/50 hover:bg-white/5">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(obj.key)}
                              onChange={() => toggleSelected(obj.key)}
                              aria-label={`Select ${basename(obj.key)}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-3 text-left"
                              onClick={() => (isFolder ? navigateTo(obj.key) : undefined)}
                            >
                              {isFolder ? (
                                <Folder className="h-5 w-5 text-cyan-300" />
                              ) : (
                                <File className="h-5 w-5 text-slate-400" />
                              )}
                              <span className="font-mono text-sm text-slate-200">{basename(obj.key)}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                            {isFolder ? 'Folder' : formatBytes(obj.size)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                            {isFolder || new Date(obj.lastModified).getTime() === 0
                              ? '-'
                              : new Date(obj.lastModified).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {!isFolder && (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                                    onClick={() => handleDownload(obj)}
                                    title="Download"
                                  >
                                    <Download className={iconClassName} />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                                    onClick={() => handleCopyLink(obj)}
                                    title={isLikelyPreviewable(obj.key) ? 'Copy VOD link' : 'Copy signed link'}
                                  >
                                    <Copy className={iconClassName} />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
                                onClick={() => openRename(obj)}
                                title={isFolder ? 'Rename folder' : 'Rename file'}
                              >
                                <Edit3 className={iconClassName} />
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-red-500/40 px-2 py-1 text-red-300 hover:bg-red-500/10"
                                onClick={() => openDelete(obj)}
                                title={isFolder ? 'Delete folder' : 'Delete file'}
                              >
                                <Trash2 className={iconClassName} />
                              </button>
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

          {selectedItems.length > 0 && (
            <Card className="p-4">
              <p className="text-sm hf-muted">
                Bulk selection is ready for follow-up actions. Individual rename, download, link, and delete actions are
                available from each row.
              </p>
            </Card>
          )}
        </div>
      )}

      <Modal
        isOpen={dialog !== null}
        onClose={closeDialog}
        title={
          dialog?.type === 'create-folder'
            ? 'New folder'
            : dialog?.type === 'rename'
              ? `Rename ${dialog.item.type === 'prefix' ? 'folder' : 'file'}`
              : `Delete ${dialog?.item.type === 'prefix' ? 'folder' : 'file'}`
        }
      >
        {dialog?.type === 'delete' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Delete <span className="font-mono text-slate-100">{basename(dialog.item.key)}</span>?
              {dialog.item.type === 'prefix' ? ' This deletes every object under that folder prefix.' : ''}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeDialog}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <TextInput
              label={dialog?.type === 'create-folder' ? 'Folder name' : 'New name'}
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              placeholder={dialog?.type === 'create-folder' ? 'mp4' : undefined}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeDialog}>Cancel</Button>
              <Button
                variant="primary"
                onClick={dialog?.type === 'create-folder' ? handleCreateFolder : handleRename}
              >
                Save
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ResourceSettingsLayout>
  );
};

export default StorageLocationSettingsPage;
