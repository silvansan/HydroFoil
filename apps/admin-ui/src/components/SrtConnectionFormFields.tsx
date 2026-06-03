import React from 'react';
import { TextInput } from '@hydrofoil/ui-kit';

import type { SrtProtocolConfig } from '../api/types';
import { CopyableUrl } from './CopyableUrl';
import {
  buildSrtConnectionUrl,
  emptySrtConfig,
  parseSrtIngestUrl,
} from '../lib/stream';

const MODE_OPTIONS: Array<{ value: SrtProtocolConfig['mode']; label: string }> = [
  { value: 'listener', label: 'Listener' },
  { value: 'caller', label: 'Caller' },
  { value: 'rendezvous', label: 'Rendez-vous' },
];

const MODE_HELP: Record<
  'ingest' | 'push',
  Record<NonNullable<SrtProtocolConfig['mode']>, string>
> = {
  ingest: {
    listener: 'HydroFoil listens — give this address to your encoder (vMix, OBS, etc.).',
    caller: 'HydroFoil connects to your encoder — enter its host and port.',
    rendezvous: 'Both sides dial the same rendezvous host and port.',
  },
  push: {
    listener:
      'Your destination listens — HydroFoil pushes when the source goes live (FFmpeg listener mode).',
    caller: 'HydroFoil connects to the remote SRT server (most common for external restream).',
    rendezvous: 'Both sides dial the same rendezvous host and port.',
  },
};

export type SrtConnectionFormFieldsProps = {
  variant: 'ingest' | 'push';
  config: SrtProtocolConfig;
  onChange: (config: SrtProtocolConfig) => void;
  /** Used for ingest listener publish URL preview. */
  ingestAppName?: string;
  defaultStreamId?: string;
  idPrefix?: string;
};

function fieldId(prefix: string | undefined, name: string) {
  return prefix ? `${prefix}-${name}` : name;
}

export const SrtConnectionFormFields: React.FC<SrtConnectionFormFieldsProps> = ({
  variant,
  config,
  onChange,
  ingestAppName = 'live',
  defaultStreamId,
  idPrefix,
}) => {
  const merged: SrtProtocolConfig = { ...emptySrtConfig('caller'), ...config };
  const mode = merged.mode || 'caller';
  const [rawSrtUrl, setRawSrtUrl] = React.useState('');

  React.useEffect(() => {
    const built = buildSrtConnectionUrl(merged, variant);
    setRawSrtUrl(built);
  }, [merged, variant]);

  const patch = (partial: Partial<SrtProtocolConfig>) => {
    onChange({ ...merged, ...partial });
  };

  const handleRawSrtUrlChange = (url: string) => {
    setRawSrtUrl(url);
    const parsed = parseSrtIngestUrl(url);
    if (parsed) {
      onChange({ ...merged, ...parsed });
    }
  };

  const srtUrlParseError =
    rawSrtUrl.trim().startsWith('srt://') &&
    rawSrtUrl.trim().length > 0 &&
    !parseSrtIngestUrl(rawSrtUrl)
      ? 'Unable to parse this SRT URL. Include host, port, and mode if needed.'
      : undefined;

  const builtUrl = buildSrtConnectionUrl(merged, variant);
  const intro =
    variant === 'ingest'
      ? 'Configure how encoders reach HydroFoil over SRT.'
      : 'Configure how HydroFoil pushes the live stream to an external SRT server.';

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/60 bg-slate-950/30 p-3">
      <p className="text-xs hf-muted">{intro}</p>

      <TextInput
        label="Raw SRT URL (optional)"
        placeholder={
          variant === 'push'
            ? 'srt://192.168.1.50:10080?mode=caller&streamid=#!::r=live/key,m=publish'
            : 'srt://encoder.example.com:10080?streamid=#!::r=live/main,m=publish'
        }
        value={rawSrtUrl}
        onChange={(e) => handleRawSrtUrlChange(e.target.value)}
      />
      {srtUrlParseError && <p className="text-xs text-rose-300">{srtUrlParseError}</p>}

      <div>
        <label className="text-sm font-medium text-slate-300" htmlFor={fieldId(idPrefix, 'mode')}>
          Connection mode
        </label>
        <select
          id={fieldId(idPrefix, 'mode')}
          className="hf-select mt-1"
          value={mode}
          onChange={(e) =>
            patch({ mode: e.target.value as SrtProtocolConfig['mode'] })
          }
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {variant === 'ingest' && option.value === 'listener'
                ? ' (HydroFoil receives)'
                : variant === 'ingest' && option.value === 'caller'
                  ? ' (HydroFoil connects)'
                  : variant === 'push' && option.value === 'caller'
                    ? ' (HydroFoil pushes out)'
                    : ''}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs hf-muted">{MODE_HELP[variant][mode]}</p>
      </div>

      {mode === 'listener' && (
        <>
          <TextInput
            label={variant === 'push' ? 'Local listen port' : 'Listening port'}
            placeholder="10080"
            type="number"
            value={merged.port?.toString() || ''}
            onChange={(e) =>
              patch({ port: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          {builtUrl && (
            <div className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-2">
              <p className="text-xs text-slate-400 mb-2">
                {variant === 'push'
                  ? 'FFmpeg will bind to this address when pushing:'
                  : 'Share this address with your encoder:'}
              </p>
              <CopyableUrl url={builtUrl} className="text-xs break-all max-w-full" onCopied={() => {}} />
            </div>
          )}
        </>
      )}

      {(mode === 'caller' || mode === 'rendezvous') && (
        <>
          <TextInput
            label={variant === 'push' ? 'Destination host / IP' : 'Host / IP address'}
            placeholder="server.example.com or 192.168.1.50"
            value={merged.host || ''}
            onChange={(e) => patch({ host: e.target.value })}
          />
          <TextInput
            label="Port"
            placeholder="10080"
            type="number"
            value={merged.port?.toString() || ''}
            onChange={(e) =>
              patch({ port: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </>
      )}

      <TextInput
        label="Stream ID (optional)"
        placeholder={defaultStreamId ?? '#!::r=live/your-key,m=publish'}
        value={merged.streamid || ''}
        onChange={(e) => patch({ streamid: e.target.value })}
      />
      <TextInput
        label="Username (optional)"
        placeholder="user"
        value={merged.username || ''}
        onChange={(e) => patch({ username: e.target.value })}
      />
      <TextInput
        label="Password (optional)"
        placeholder="••••••••"
        type="password"
        value={merged.password || ''}
        onChange={(e) => patch({ password: e.target.value })}
      />
      <TextInput
        label="Encryption passphrase (optional)"
        placeholder="10–79 characters if required"
        type="password"
        value={merged.encryptionKey || ''}
        onChange={(e) => patch({ encryptionKey: e.target.value })}
      />

      {variant === 'push' && builtUrl && mode !== 'listener' && (
        <div className="rounded-lg border border-slate-600/50 bg-slate-700/30 p-2">
          <p className="text-xs text-slate-400 mb-2">Push URL preview:</p>
          <CopyableUrl url={builtUrl} className="text-xs break-all max-w-full" onCopied={() => {}} />
        </div>
      )}

      {variant === 'ingest' && ingestAppName && mode !== 'listener' && builtUrl && (
        <p className="text-xs hf-muted">
          Ingest path uses application <span className="font-mono text-slate-400">{ingestAppName}</span>{' '}
          when Stream ID is omitted.
        </p>
      )}
    </div>
  );
};

export default SrtConnectionFormFields;
