import React from 'react';
import { TextInput } from '@hydrofoil/ui-kit';

import {
  ABR_LADDER_FULL,
  ABR_LADDER_STANDARD,
  AUDIO_HANDLING_OPTIONS,
  sortRenditionsByHeight,
  totalVideoBitrateKbps,
  type StreamProfileFormValues,
} from '../lib/stream-profile';

type StreamProfileFormFieldsProps = {
  values: StreamProfileFormValues;
  onChange: (patch: Partial<StreamProfileFormValues>) => void;
  fieldErrors?: Record<string, string>;
};

export const StreamProfileFormFields: React.FC<StreamProfileFormFieldsProps> = ({
  values,
  onChange,
  fieldErrors = {},
}) => {
  const updateRendition = (index: number, patch: Partial<StreamProfileFormValues['renditions'][0]>) => {
    onChange({
      renditions: values.renditions.map((rendition, i) =>
        i === index ? { ...rendition, ...patch } : rendition
      ),
    });
  };

  const addRendition = () => {
    onChange({
      renditions: [
        ...values.renditions,
        { name: '360p', resolution: '640x360', videoBitrate: '900', fps: '30' },
      ],
    });
  };

  const removeRendition = (index: number) => {
    onChange({
      renditions: values.renditions.filter((_, i) => i !== index),
    });
  };

  const applyLadder = (ladder: StreamProfileFormValues['renditions']) => {
    onChange({
      mode: 'transcode',
      renditions: ladder.map((row) => ({ ...row })),
    });
  };

  const sortedForDisplay = sortRenditionsByHeight(values.renditions);
  const estimatedKbps = totalVideoBitrateKbps(
    sortedForDisplay.map((r) => ({ videoBitrate: r.videoBitrate }))
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">1. Profile name</h3>
          <p className="mt-0.5 text-xs hf-muted">Shown when assigning profiles to stream keys.</p>
        </div>
        <TextInput
          label="Name"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          error={fieldErrors.name}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">2. Delivery mode</h3>
          <p className="mt-0.5 text-xs hf-muted">
            Passthrough forwards the source encode. Transcode builds an adaptive bitrate ladder in
            gateway desired config.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                mode: 'passthrough' as const,
                title: 'Passthrough',
                description: 'No extra video encodes — lowest gateway CPU.',
              },
              {
                mode: 'transcode' as const,
                title: 'ABR transcode',
                description: 'Multiple H.264 renditions for players to switch quality.',
              },
            ] as const
          ).map((option) => (
            <label
              key={option.mode}
              className={`flex cursor-pointer flex-col rounded-xl border px-4 py-3 transition-colors ${
                values.mode === option.mode
                  ? 'border-brand-500/40 bg-brand-600/10'
                  : 'border-slate-800/80 bg-slate-900/30 hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="stream-profile-mode"
                  checked={values.mode === option.mode}
                  onChange={() => onChange({ mode: option.mode })}
                  className="border-slate-600 text-brand-500"
                />
                <span className="text-sm font-medium text-slate-100">{option.title}</span>
              </span>
              <span className="mt-2 text-xs hf-muted pl-6">{option.description}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">3. Audio handling</h3>
          <p className="mt-0.5 text-xs hf-muted">
            For audio-only podcast files, use Audio Feed Profiles instead.
          </p>
        </div>
        <div className="space-y-2">
          {AUDIO_HANDLING_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors ${
                values.audioHandling === option.value
                  ? 'border-brand-500/40 bg-brand-600/10'
                  : 'border-slate-800/80 bg-slate-900/30 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="stream-profile-audio"
                checked={values.audioHandling === option.value}
                onChange={() => onChange({ audioHandling: option.value })}
                className="mt-1 border-slate-600 text-brand-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-100">{option.label}</span>
                <span className="block text-xs hf-muted mt-0.5">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {values.mode === 'transcode' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">4. Rendition ladder</h3>
              <p className="mt-0.5 text-xs hf-muted">
                Highest rung first. Estimated combined video bitrate:{' '}
                <span className="text-slate-300">~{estimatedKbps} kbps</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-brand-500/40 hover:text-brand-300"
                onClick={() => applyLadder(ABR_LADDER_FULL)}
              >
                Full ladder
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-brand-500/40 hover:text-brand-300"
                onClick={() => applyLadder(ABR_LADDER_STANDARD)}
              >
                720p ladder
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-slate-600"
                onClick={() => onChange({ renditions: sortRenditionsByHeight(values.renditions) })}
              >
                Sort by resolution
              </button>
            </div>
          </div>

          {fieldErrors.renditions && (
            <p className="text-sm text-red-400">{fieldErrors.renditions}</p>
          )}

          <div className="space-y-3 rounded-lg border border-slate-700/70 bg-slate-950/40 p-3">
            {values.renditions.map((rendition, index) => (
              <div
                key={`${rendition.name}-${index}`}
                className="grid gap-2 rounded-lg border border-slate-800 p-3 md:grid-cols-4"
              >
                <TextInput
                  label="Label"
                  value={rendition.name}
                  onChange={(e) => updateRendition(index, { name: e.target.value })}
                />
                <TextInput
                  label="Resolution"
                  placeholder="1280x720"
                  value={rendition.resolution}
                  onChange={(e) => updateRendition(index, { resolution: e.target.value })}
                />
                <TextInput
                  label="Video kbps"
                  value={rendition.videoBitrate}
                  onChange={(e) => updateRendition(index, { videoBitrate: e.target.value })}
                />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <TextInput
                      label="FPS"
                      value={rendition.fps}
                      onChange={(e) => updateRendition(index, { fps: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-red-500/40 px-2 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    onClick={() => removeRendition(index)}
                    disabled={values.renditions.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-sm hf-link"
              onClick={addRendition}
            >
              + Add rendition
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
