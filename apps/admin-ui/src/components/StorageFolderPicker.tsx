import React from 'react';
import { Button, Modal, TextInput } from '@hydrofoil/ui-kit';
import { Folder, FolderPlus, RefreshCw } from 'lucide-react';

import { api } from '../api/client';
import { Alert } from './Alert';

type StorageFolderPickerProps = {
  storageLocationId: string;
  value: string;
  onChange: (prefix: string) => void;
  disabled?: boolean;
  label?: string;
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

export const StorageFolderPicker: React.FC<StorageFolderPickerProps> = ({
  storageLocationId,
  value,
  onChange,
  disabled = false,
  label = 'Path prefix',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [prefix, setPrefix] = React.useState(value);
  const [items, setItems] = React.useState<StorageBrowserItem[]>([]);
  const [bucketName, setBucketName] = React.useState('');
  const [newFolderName, setNewFolderName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const folders = React.useMemo(
    () => items.filter((item) => item.type === 'prefix'),
    [items]
  );

  const loadFolders = React.useCallback(
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
        setError(err instanceof Error ? err.message : 'Failed to browse storage folders');
      } finally {
        setIsLoading(false);
      }
    },
    [prefix, storageLocationId]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setPrefix(value);
    loadFolders(value).catch(() => undefined);
  }, [isOpen, loadFolders, value]);

  const crumbs = prefix ? trimSlashes(prefix).split('/').filter(Boolean) : [];

  const handleChoose = () => {
    onChange(trimSlashes(prefix));
    setIsOpen(false);
  };

  const handleCreateFolder = async () => {
    const name = trimSlashes(newFolderName);
    if (!storageLocationId || !name) return;
    const folderPrefix = ensureFolderKey(joinKey(prefix, name));
    await api.createStorageFolder(storageLocationId, folderPrefix);
    setNewFolderName('');
    await loadFolders(prefix);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="media/recordings/mp4"
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

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Choose storage folder">
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
            <p className="break-all font-mono text-xs hf-muted">
              s3://{bucketName || 'bucket'}/{prefix}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <button
                type="button"
                className="hf-breadcrumb-home"
                onClick={() => loadFolders('')}
              >
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
                      onClick={() => loadFolders(crumbPrefix)}
                    >
                      {part}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
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
            <Button type="button" variant="secondary" onClick={() => loadFolders(prefix)}>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </span>
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-700/70">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm hf-muted">Loading folders...</div>
            ) : folders.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm hf-muted">
                No subfolders here. You can choose this prefix or create a folder.
              </div>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  className="flex w-full items-center gap-3 border-b border-[var(--hf-border)] px-4 py-3 text-left hover:bg-white/5"
                  onClick={() => loadFolders(folder.key)}
                >
                  <Folder className="h-5 w-5 text-cyan-300" />
                  <span className="font-mono text-sm text-slate-200">{basename(folder.key)}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-between gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onChange(trimSlashes(prefix))}>
              Use without closing
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleChoose}>
                Use this folder
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
