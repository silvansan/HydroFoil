import React from 'react';
import { Link } from 'react-router-dom';
import { TextInput } from '@hydrofoil/ui-kit';

import {
  PLAYBACK_ACCESS_OPTIONS,
  type PlaybackAccessPolicy,
  policyFormErrors,
  previewPolicySlug,
  validateAllowedDomains,
} from '../lib/privacy-policy';

export type PolicyTargetType = 'stream' | 'vod';

export type PrivacyPolicyFormValues = {
  name: string;
  allowedDomains: string;
  playbackAccessPolicy: PlaybackAccessPolicy;
  targetType: PolicyTargetType;
  attachTarget: string;
};

type AssignmentOption = { value: string; label: string; hint?: string };

type PrivacyPolicyFormFieldsProps = {
  values: PrivacyPolicyFormValues;
  onChange: (patch: Partial<PrivacyPolicyFormValues>) => void;
  streamOptions: AssignmentOption[];
  vodOptions: AssignmentOption[];
  showTargetPicker?: boolean;
  variant?: 'create' | 'edit';
  /** Existing policy slugs — used to preview auto-generated ID on create. */
  existingSlugs?: string[];
  /** Shown on edit — internal ID does not change when the display name changes. */
  lockedSlug?: string;
  idPrefix?: string;
  fieldErrors?: Record<string, string>;
  showValidation?: boolean;
};

function fieldId(prefix: string | undefined, name: string) {
  return prefix ? `${prefix}-${name}` : name;
}

export const PrivacyPolicyFormFields: React.FC<PrivacyPolicyFormFieldsProps> = ({
  values,
  onChange,
  streamOptions,
  vodOptions,
  showTargetPicker = true,
  variant = 'create',
  existingSlugs = [],
  lockedSlug,
  idPrefix,
  fieldErrors: externalErrors,
  showValidation = false,
}) => {
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});
  const showDomains = values.playbackAccessPolicy === 'restricted';
  const selectedAccess = PLAYBACK_ACCESS_OPTIONS.find((o) => o.value === values.playbackAccessPolicy);
  const computedErrors = showValidation ? policyFormErrors(values) : {};
  const errors = { ...computedErrors, ...externalErrors };
  const targetOptions = values.targetType === 'stream' ? streamOptions : vodOptions;
  const domainHint =
    touched.allowedDomains && showDomains ? validateAllowedDomains(values.allowedDomains) : null;
  const slugPreview =
    variant === 'create' && values.name.trim()
      ? previewPolicySlug(values.name, existingSlugs)
      : '';

  return (
    <div className="space-y-6">
      {showTargetPicker && (
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">1. What does this protect?</h3>
            <p className="mt-0.5 text-xs hf-muted">
              Pick a live output or on-demand route. You can attach more targets after saving.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: 'stream' as const, label: 'Live stream output' },
                { value: 'vod' as const, label: 'On-demand (VOD)' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ targetType: option.value, attachTarget: '' })}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  values.targetType === option.value
                    ? 'border-brand-500/50 bg-brand-600/15 text-brand-300'
                    : 'border-slate-700/80 text-slate-300 hover:border-slate-600'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <label
              className="text-sm font-medium text-slate-300"
              htmlFor={fieldId(idPrefix, 'attach-target')}
            >
              {values.targetType === 'stream' ? 'Live output' : 'VOD route'}
              <span className="ml-1 font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id={fieldId(idPrefix, 'attach-target')}
              className="hf-select mt-1"
              value={values.attachTarget}
              onChange={(e) => onChange({ attachTarget: e.target.value })}
            >
              <option value="">Assign later on the policy page</option>
              {targetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {targetOptions.length === 0 && (
              <p className="mt-2 text-xs hf-muted">
                No {values.targetType === 'stream' ? 'outputs' : 'VOD routes'} yet.{' '}
                <Link
                  to={values.targetType === 'stream' ? '/restreaming' : '/vod-routes'}
                  className="text-brand-400 hover:underline"
                >
                  Create one first
                </Link>{' '}
                or save and attach targets from the policy settings page.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {showTargetPicker ? '2. Who can watch?' : 'Who can watch?'}
          </h3>
          <p className="mt-0.5 text-xs hf-muted">Choose how strict browser and embed access should be.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PLAYBACK_ACCESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ playbackAccessPolicy: option.value })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                values.playbackAccessPolicy === option.value
                  ? 'border-brand-500/50 bg-brand-600/15 text-brand-300'
                  : 'border-slate-700/80 text-slate-400 hover:border-slate-600'
              }`}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>

        <div className="space-y-2" role="radiogroup" aria-label="Playback access">
          {PLAYBACK_ACCESS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors ${
                values.playbackAccessPolicy === option.value
                  ? 'border-brand-500/40 bg-brand-600/10'
                  : 'border-slate-800/80 bg-slate-900/30 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name={fieldId(idPrefix, 'access')}
                value={option.value}
                checked={values.playbackAccessPolicy === option.value}
                onChange={() => onChange({ playbackAccessPolicy: option.value })}
                className="mt-1 border-slate-600 text-brand-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-100">{option.title}</span>
                <span className="block text-xs hf-muted mt-0.5">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {selectedAccess && (
          <p className="text-xs hf-muted rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
            {selectedAccess.browserNote}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {showTargetPicker ? '3. Name this policy' : 'Policy name'}
          </h3>
          <p className="mt-0.5 text-xs hf-muted">A label your team will recognize in lists and dropdowns.</p>
        </div>

        <TextInput
          label="Display name"
          placeholder="e.g. Partner sites only"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
        />
        {touched.name && errors.name && <p className="text-xs text-red-400 -mt-2">{errors.name}</p>}

        {variant === 'create' && slugPreview && (
          <p className="text-xs hf-muted -mt-1">
            Internal ID: <span className="font-mono text-slate-400">{slugPreview}</span>
            <span className="text-slate-500"> — assigned automatically when you create</span>
          </p>
        )}
        {variant === 'edit' && lockedSlug && (
          <p className="text-xs hf-muted -mt-1">
            Internal ID: <span className="font-mono text-slate-400">{lockedSlug}</span>
            <span className="text-slate-500"> — fixed after creation</span>
          </p>
        )}

        {showDomains ? (
          <div>
            <label
              className="text-sm font-medium text-slate-300"
              htmlFor={fieldId(idPrefix, 'domains')}
            >
              Allowed websites
            </label>
            <textarea
              id={fieldId(idPrefix, 'domains')}
              className={`hf-input mt-1 min-h-[5rem] font-mono text-xs ${
                domainHint || errors.allowedDomains ? 'border-red-500/50' : ''
              }`}
              placeholder={'yoursite.com\n*.partner.org\nembed.customer.io'}
              value={values.allowedDomains}
              onChange={(e) => onChange({ allowedDomains: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, allowedDomains: true }))}
            />
            {(domainHint || errors.allowedDomains) && (
              <p className="mt-1 text-xs text-red-400">{errors.allowedDomains ?? domainHint}</p>
            )}
            {!domainHint && !errors.allowedDomains && (
              <p className="mt-1 text-xs hf-muted">
                One domain per line, or comma-separated. Use{' '}
                <code className="text-slate-400">*.domain.com</code> for subdomains.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs hf-muted">
            Domain allowlists apply only when you choose &ldquo;Only listed websites.&rdquo;
          </p>
        )}
      </section>
    </div>
  );
};

export default PrivacyPolicyFormFields;
