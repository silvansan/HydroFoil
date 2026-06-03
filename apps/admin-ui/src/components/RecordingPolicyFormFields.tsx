import React from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';

import type { StorageLocation } from '../api/types';
import { StorageFolderPicker } from './StorageFolderPicker';
import {
  FILENAME_TEMPLATE_VARS,
  applyFilenameTemplate,
  buildObjectKeyPreview,
  type RecordingPolicyFormValues,
} from '../lib/recording-storage';

type RecordingPolicyFormFieldsProps = {
  values: RecordingPolicyFormValues;
  onChange: (patch: Partial<RecordingPolicyFormValues>) => void;
  locations: StorageLocation[];
  fieldErrors?: Record<string, string>;
  showEnabledToggle?: boolean;
};

export const RecordingPolicyFormFields: React.FC<RecordingPolicyFormFieldsProps> = ({
  values,
  onChange,
  locations,
  fieldErrors = {},
  showEnabledToggle = false,
}) => {
  const selectedLocation = locations.find((loc) => loc.id === values.storageLocationId);
  const sampleKey = applyFilenameTemplate(values.filenameTemplate, {
    app: 'live',
    streamKey: 'main',
  });
  const preview = buildObjectKeyPreview(selectedLocation, values.pathPrefix, sampleKey);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">1. Storage location</h3>
          <p className="mt-0.5 text-xs hf-muted">
            Recordings are written under this bucket.{' '}
            <Link to="/storage" className="text-brand-400 hover:underline">
              Manage storage
            </Link>
          </p>
        </div>
        {locations.length === 0 ? (
          <p className="text-sm hf-muted rounded-lg border border-slate-800/60 p-3">
            No storage locations yet.{' '}
            <Link to="/storage" className="text-brand-400 hover:underline">
              Create one first
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {locations.map((location) => (
              <label
                key={location.id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  values.storageLocationId === location.id
                    ? 'border-brand-500/40 bg-brand-600/10'
                    : 'border-slate-800/80 bg-slate-900/30 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="recording-storage-location"
                  checked={values.storageLocationId === location.id}
                  onChange={() =>
                    onChange({
                      storageLocationId: location.id,
                      pathPrefix: values.pathPrefix || 'dvr',
                    })
                  }
                  className="mt-1 border-slate-600 text-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-100">{location.name}</span>
                  <span className="block font-mono text-xs text-slate-500 mt-0.5">
                    {location.type} · {location.bucketName}
                    {location.prefixPath ? ` / ${location.prefixPath}` : ''}
                  </span>
                </span>
                <Link
                  to={`/storage/${location.id}`}
                  className="text-xs text-brand-400 hover:underline self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  Browse
                </Link>
              </label>
            ))}
          </div>
        )}
        {fieldErrors.storageLocationId && (
          <p className="text-xs text-red-400">{fieldErrors.storageLocationId}</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">2. Folder & filename</h3>
          <p className="mt-0.5 text-xs hf-muted">
            Path under the bucket root; template controls per-recording object names.
          </p>
        </div>
        <StorageFolderPicker
          storageLocationId={values.storageLocationId}
          value={values.pathPrefix}
          onChange={(pathPrefix) => onChange({ pathPrefix })}
          disabled={!values.storageLocationId}
          label="Recording folder (path prefix)"
        />
        {fieldErrors.pathPrefix && (
          <p className="text-xs text-red-400 -mt-1">{fieldErrors.pathPrefix}</p>
        )}

        <TextInput
          label="Filename template"
          value={values.filenameTemplate}
          onChange={(e) => onChange({ filenameTemplate: e.target.value })}
        />
        <div className="flex flex-wrap gap-1.5">
          {FILENAME_TEMPLATE_VARS.map((v) => (
            <button
              key={v.token}
              type="button"
              className="rounded-md border border-slate-700/80 px-2 py-0.5 font-mono text-xs text-slate-300 hover:border-brand-500/40 hover:text-brand-300"
              onClick={() => {
                if (values.filenameTemplate.includes(v.token)) return;
                const next = values.filenameTemplate.trim()
                  ? `${values.filenameTemplate.replace(/\/$/, '')}/${v.token}`
                  : v.token;
                onChange({ filenameTemplate: next });
              }}
            >
              {v.token}
            </button>
          ))}
        </div>
        {fieldErrors.filenameTemplate && (
          <p className="text-xs text-red-400 -mt-1">{fieldErrors.filenameTemplate}</p>
        )}

        <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
          <p className="text-xs hf-muted">Example object key</p>
          <p className="mt-1 font-mono text-xs text-slate-300 break-all">{preview}</p>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">3. Finalize & retention</h3>
          <p className="mt-0.5 text-xs hf-muted">What happens when the live stream stops.</p>
        </div>
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 space-y-3">
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 accent-brand-400"
              checked={values.remuxToMp4}
              onChange={(e) => onChange({ remuxToMp4: e.target.checked })}
            />
            <span>
              <span className="font-medium">Remux to MP4 when live ends</span>
              <span className="block text-xs hf-muted mt-0.5">
                SRS keeps FLV during the event; workers finalize to MP4 after stop.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              className="mt-1 accent-brand-400"
              checked={values.keepSourceFlvFor24h}
              disabled={!values.remuxToMp4}
              onChange={(e) => onChange({ keepSourceFlvFor24h: e.target.checked })}
            />
            <span>
              <span className="font-medium">Keep source FLV for 24 hours</span>
              <span className="block text-xs hf-muted mt-0.5">
                Recovery copy if remux or playback validation needs a fallback.
              </span>
            </span>
          </label>
        </div>
        <TextInput
          label="Retention (days, optional)"
          placeholder="Leave empty for no automatic expiry"
          value={values.retentionDays}
          onChange={(e) => onChange({ retentionDays: e.target.value })}
        />
        {fieldErrors.retentionDays && (
          <p className="text-xs text-red-400 -mt-2">{fieldErrors.retentionDays}</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {showEnabledToggle ? '4. Policy name & status' : '4. Policy name'}
          </h3>
        </div>
        <TextInput
          label="Display name"
          placeholder="e.g. Main DVR"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {fieldErrors.name && <p className="text-xs text-red-400 -mt-2">{fieldErrors.name}</p>}
        {showEnabledToggle && (
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
              className="accent-brand-400"
            />
            Policy enabled (assigned stream keys can record)
          </label>
        )}
      </section>
    </div>
  );
};

export default RecordingPolicyFormFields;
