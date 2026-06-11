import React from 'react';
import { Button, Modal, TextInput } from '@hydrofoil/ui-kit';
import { File, Folder, FolderPlus, RefreshCw } from 'lucide-react';

import { api } from '../api/client';
import { Alert } from './Alert';

type StorageSourcePickerProps = {
  storageLocationId: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  label?: string;
  deliveryType: 'hls' | 'progressive';
};

type StorageBrowserItem = {
  key: string;
  type?: 'object' | 'prefix';
};

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function basename(key: string): string {
  const clean = trimSlashes(key);
  return clean.split('/').filter(Boolean).pop() ?? clean;
}

function joinKey(prefix: string, name: string): string {
  return [trimSlashes(prefix), name.replace(/^\/+/, '')].filter(Boolean).join('/');
}

function ensureFolderKey(prefix: string): string {
  const clean = trimSlashes(prefix);
  return clean ? `${clean}/` : '';
}

function isSelectableFile(key: string, deliveryType: 'hls' | 'progressive'): boolean {
  if (deliveryType === 'hls') {
    return /\.m3u8$/i.test(key);
  }
  return /\.(aac|flac|m4a|m4v|mkv|mov|mp3|mp4|ogg|wav|webm)$/i.test(key);
}

export const StorageSourcePicker: React.FC<StorageSourcePickerProps> = ({
  storageLocationId,
  value,
  onChange,
  disabled = false,
  label,
  deliveryType,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [prefix, setPrefix] = React.useState(value);
  const [items, setItems] = React.useState<StorageBrowserItem[]>([]);
  const [bucketName, setBucketName] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const fieldLabel =
    label ??
    (deliveryType === 'hls' ? 'Manifest path' : 'File path or prefix');

  const loadItems = React.useCallback(
    async (nextPrefix = prefix) => {
      if (!storageLocationId) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.listStorageObjects(
          storageLocationId,
          trimSlashes(nextPrefix) || undefined
        );
        setItems(result.items);
        setBucketName(result.bucketName);
        setPrefix(result.prefix);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to browse storage');
      } finally {
        setIsLoading(false);
      }
    },
    [prefix, storageLocationId]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setPrefix(value);
    loadItems(value).catch(() => undefined);
  }, [isOpen, loadItems, value]);

  const crumbs = prefix ? trimSlashes(prefix).split('/').filter(Boolean) : [];

  const handleChooseFolder = () => {
    onChange(trimSlashes(prefix));
    setIsOpen(false);
  };

  const handleChooseFile = (key: string) => {
    onChange(trimSlashes(key));
    setIsOpen(false);
  };

  const handleCreateFolder = async () => {
    const name = trimSlashes(newFolderName);
    if (!storageLocationId || !name) return;
    const folderPrefix = ensureFolderKey(joinKey(prefix, name));
    await api.createStorageFolder(storageLocationId, folderPrefix);
    setNewFolderName('');
    await loadItems(prefix);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput
            label={fieldLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              deliveryType === 'hls'
                ? 'vod/demo/index.m3u8'
                : 'archive/ or archive/2026-05-31R.mp4'
            }
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsOpen(true)}
          disabled={disabled || !storageLocationId}
        >
          Browse
        </Button>
      </div>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Choose storage source">
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
            <p className="break-all font-mono text-xs hf-muted">
              s3://{bucketName || 'bucket'}/{prefix}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="hf-breadcrumb-home" onClick={() => loadItems('')}>
                Home
              </button>
              {crumbs.map((part, index) => {
                const crumbPrefix = crumbs.slice(0, index + 1).join('/');
                return (
                  <React.Fragment key={crumbPrefix}>
                    <span className="hf-muted">/</span>
                    <button
                      type="button"
                      className="hf-breadcrumb-segment"
                      onClick={() => loadItems(crumbPrefix)}
                    >
                      {part}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <TextInput
                label="Create folder here"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="mp4"
              />
            </div>
            <Button type="button" variant="secondary" onClick={handleCreateFolder}>
              <span className="inline-flex items-center gap-2">
                <FolderPlus className="h-4 w-4" /> Add
              </span>
            </Button>
            <Button type="button" variant="secondary" onClick={() => loadItems(prefix)}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </span>
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-700/70">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm hf-muted">Loading storage...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm hf-muted">
                No objects here. Upload files in Storage Explorer or create a folder.
              </div>
            ) : (
              items.map((item) => {
                const isFolder = item.type === 'prefix';
                const selectable = !isFolder && isSelectableFile(item.key, deliveryType);
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3 border-b border-[var(--hf-border)] px-4 py-3"
                  >
                    <button
                      type="button"
                      className="inline-flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => (isFolder ? loadItems(item.key) : undefined)}
                    >
                      {isFolder ? (
                        <Folder className="h-5 w-5 shrink-0 text-cyan-300" />
                      ) : (
                        <File className="h-5 w-5 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate font-mono text-sm text-slate-200">
                        {basename(item.key)}
                      </span>
                    </button>
                    {selectable && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleChooseFile(item.key)}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {deliveryType === 'progressive' ? (
              <Button type="button" variant="secondary" onClick={handleChooseFolder}>
                Use this folder
              </Button>
            ) : (
              <span className="text-xs hf-muted self-center">
                Select an `.m3u8` manifest from the list.
              </span>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              {deliveryType === 'progressive' && (
                <Button type="button" variant="primary" onClick={handleChooseFolder}>
                  Use folder
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
