import React from 'react';

import { TextInput } from '@hydrofoil/ui-kit';
import type { StorageLocationFormValues } from '../lib/recording-storage';
import { STORAGE_TYPE_OPTIONS } from '../lib/recording-storage';

type StorageLocationFormFieldsProps = {
  values: StorageLocationFormValues;
  onChange: (patch: Partial<StorageLocationFormValues>) => void;
  fieldErrors?: Record<string, string>;
};

export const StorageLocationFormFields: React.FC<StorageLocationFormFieldsProps> = ({
  values,
  onChange,
  fieldErrors = {},
}) => {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">1. Basics</h3>
          <p className="mt-0.5 text-xs hf-muted">Name and bucket this location points at.</p>
        </div>
        <TextInput
          label="Display name"
          placeholder="e.g. Primary MinIO"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {fieldErrors.name && <p className="text-xs text-red-400 -mt-2">{fieldErrors.name}</p>}

        <div className="flex flex-wrap gap-2">
          {STORAGE_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange({
                  type: option.value,
                  useSsl: option.value === 's3' ? true : values.useSsl,
                })
              }
              className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                values.type === option.value
                  ? 'border-brand-500/50 bg-brand-600/15 text-brand-300'
                  : 'border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
            >
              <span className="block font-medium">{option.label}</span>
              <span className="block text-xs hf-muted mt-0.5">{option.description}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Bucket"
            value={values.bucketName}
            onChange={(e) => onChange({ bucketName: e.target.value })}
          />
          <TextInput
            label="Root prefix"
            placeholder="media"
            value={values.prefixPath}
            onChange={(e) => onChange({ prefixPath: e.target.value })}
          />
        </div>
        {(fieldErrors.bucketName || fieldErrors.prefixPath) && (
          <p className="text-xs text-red-400">
            {fieldErrors.bucketName ?? fieldErrors.prefixPath}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">2. Connection</h3>
          <p className="mt-0.5 text-xs hf-muted">
            Leave endpoint empty for MinIO to use server environment defaults.
          </p>
        </div>
        <div className="rounded-lg border border-slate-700/70 bg-slate-950/40 p-3 space-y-3">
          <TextInput
            label="Endpoint"
            placeholder={
              values.type === 's3'
                ? 's3.eu-central-1.amazonaws.com'
                : 'optional — uses env default'
            }
            value={values.endpoint}
            onChange={(e) => onChange({ endpoint: e.target.value })}
          />
          {fieldErrors.endpoint && (
            <p className="text-xs text-red-400 -mt-2">{fieldErrors.endpoint}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Region"
              placeholder="eu-central-1"
              value={values.region}
              onChange={(e) => onChange({ region: e.target.value })}
            />
            <TextInput
              label="Public endpoint"
              placeholder="Optional CDN / browser host"
              value={values.publicEndpoint}
              onChange={(e) => onChange({ publicEndpoint: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.useSsl}
                onChange={(e) => onChange({ useSsl: e.target.checked })}
                className="accent-brand-400"
              />
              Use SSL
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={values.pathStyle}
                onChange={(e) => onChange({ pathStyle: e.target.checked })}
                className="accent-brand-400"
              />
              Path-style requests
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">3. Credentials</h3>
          <p className="mt-0.5 text-xs text-amber-200/90">
            Keys are write-only in the UI and never shown again after save.
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
          <TextInput
            label="Access key"
            value={values.accessKey}
            onChange={(e) => onChange({ accessKey: e.target.value })}
          />
          <TextInput
            label="Secret key"
            type="password"
            value={values.secretKey}
            onChange={(e) => onChange({ secretKey: e.target.value })}
          />
          {(fieldErrors.accessKey || fieldErrors.secretKey) && (
            <p className="text-xs text-red-400">
              {fieldErrors.accessKey ?? fieldErrors.secretKey}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default StorageLocationFormFields;
