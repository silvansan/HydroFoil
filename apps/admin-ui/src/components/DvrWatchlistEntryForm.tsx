import React from 'react';
import { Button, Modal, TextInput } from '@hydrofoil/ui-kit';
import { Alert } from './Alert';
import { api } from '../api/client';
import type { DvrWatchlistEntry } from '../api/types';

interface DvrWatchlistEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (entry: DvrWatchlistEntry) => void;
  entry?: DvrWatchlistEntry;
}

export const DvrWatchlistEntryForm: React.FC<DvrWatchlistEntryFormProps> = ({
  isOpen,
  onClose,
  onSaved,
  entry,
}) => {
  const [applicationName, setApplicationName] = React.useState('');
  const [streamPattern, setStreamPattern] = React.useState('*');
  const [retentionHours, setRetentionHours] = React.useState('24');
  const [storageLocationId, setStorageLocationId] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [storageLocations, setStorageLocations] = React.useState<{
    id: string;
    name: string;
  }[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    api.listStorageLocations().then((res) => {
      const locations = res.items ?? [];
      setStorageLocations(locations);
      if (entry) {
        setStorageLocationId(entry.storageLocationId);
      } else if (locations[0]?.id) {
        setStorageLocationId(locations[0].id);
      }
    });
  }, [isOpen, entry]);

  React.useEffect(() => {
    if (!entry) {
      setApplicationName('');
      setStreamPattern('*');
      setRetentionHours('24');
      setStorageLocationId('');
      setEnabled(true);
      setError(null);
      return;
    }

    setApplicationName(entry.applicationName ?? '');
    setStreamPattern(entry.streamPattern ?? '*');
    setRetentionHours(String(entry.retentionHours));
    setStorageLocationId(entry.storageLocationId);
    setEnabled(entry.enabled);
    setError(null);
  }, [entry, isOpen]);

  const handleSubmit = async () => {
    setError(null);
    try {
      const payload = {
        streamPattern: streamPattern.trim() || '*',
        retentionHours: Number(retentionHours) || 24,
        storageLocationId,
        enabled,
      };

      const savedEntry = entry
        ? await api.updateDvrWatchlistEntry(entry.id, payload)
        : await api.createDvrWatchlistEntry({
            applicationName: applicationName.trim(),
            ...payload,
          });

      onSaved(savedEntry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save DVR watchlist entry');
    }
  };

  const title = entry ? 'Edit DVR watchlist entry' : 'Add DVR watchlist entry';
  const submitLabel = entry ? 'Save changes' : 'Add watchlist entry';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <TextInput
          label="Application name"
          value={applicationName}
          onChange={(e) => setApplicationName(e.target.value)}
          placeholder="THISAPP"
          disabled={Boolean(entry)}
        />
        <TextInput
          label="Stream pattern"
          value={streamPattern}
          onChange={(e) => setStreamPattern(e.target.value)}
          placeholder="* or THISSTREAM"
        />
        <TextInput
          label="Retention (hours)"
          value={retentionHours}
          type="number"
          min={1}
          onChange={(e) => setRetentionHours(e.target.value)}
        />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-300">Storage location</span>
          <select
            className="hf-select"
            value={storageLocationId}
            onChange={(e) => setStorageLocationId(e.target.value)}
          >
            {storageLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span className="text-slate-300">Enabled</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={(!entry && !applicationName.trim()) || !storageLocationId}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
