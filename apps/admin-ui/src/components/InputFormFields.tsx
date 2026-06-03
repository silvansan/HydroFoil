import React from 'react';
import { Button, TextInput } from '@hydrofoil/ui-kit';

import type { Input, ProtocolConfig, RtspProtocolConfig, SrtProtocolConfig } from '../api/types';
import { CopyableUrl } from './CopyableUrl';
import { SrtConnectionFormFields } from './SrtConnectionFormFields';
import {
  emptySrtConfig,
  generateIngestUrl,
  generateStreamKey,
  resolveInputStreamKey,
  rtmpIngestUrl,
  usesGeneratedStreamKey,
} from '../lib/stream';

export interface InputFormState {
  name: string;
  streamKey: string;
  ingestProtocol: Input['ingestProtocol'];
  protocolConfig?: ProtocolConfig;
}

interface InputFormFieldsProps {
  appName: string;
  form: InputFormState;
  onChange: (next: InputFormState) => void;
}

export const InputFormFields: React.FC<InputFormFieldsProps> = ({ appName, form, onChange }) => {
  const autoStreamKey = resolveInputStreamKey(form.name, form.ingestProtocol, form.streamKey);
  const showStreamKeyField = !usesGeneratedStreamKey(form.ingestProtocol);
  const handleProtocolChange = (protocol: Input['ingestProtocol']) => {
    // Reset protocol config when switching protocols
    onChange({
      ...form,
      ingestProtocol: protocol,
      protocolConfig: protocol === 'srt' ? emptySrtConfig('caller') : undefined,
    });
  };

  const handleProtocolConfigChange = (config: Partial<ProtocolConfig>) => {
    onChange({
      ...form,
      protocolConfig: { ...form.protocolConfig, ...config } as ProtocolConfig,
    });
  };

  const getPublishUrl = (): string => {
    switch (form.ingestProtocol) {
      case 'rtmp':
        return rtmpIngestUrl(form.streamKey, appName);
      case 'rtsp':
        return generateIngestUrl('rtsp', undefined, form.protocolConfig as RtspProtocolConfig);
      case 'srt':
        return generateIngestUrl('srt', undefined, form.protocolConfig as SrtProtocolConfig);
      case 'hls':
        return `http://localhost:8080/${appName}/${autoStreamKey}.m3u8`;
      case 'http':
        return `http://localhost:8080/${appName}/${autoStreamKey}`;
      default:
        return '';
    }
  };

  const publishUrl = getPublishUrl();

  return (
    <div className="space-y-4">
      <TextInput
        label="Stream label"
        placeholder="English feed"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />

      <div>
        <label className="text-sm font-medium text-slate-300">Ingest protocol</label>
        <select
          className="hf-select mt-1"
          value={form.ingestProtocol}
          onChange={(e) =>
            handleProtocolChange(e.target.value as Input['ingestProtocol'])
          }
        >
          <option value="rtmp">RTMP</option>
          <option value="rtsp">RTSP</option>
          <option value="srt">SRT</option>
          <option value="hls">HLS</option>
          <option value="http">HTTP</option>
        </select>
        <p className="mt-2 text-xs hf-muted">
          Only one ingest protocol is active at a time. Choose RTMP or SRT, not both.
        </p>
      </div>

      {showStreamKeyField && (
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <TextInput
                label="Stream key"
                placeholder="en-main-a1b2c3"
                value={form.streamKey}
                onChange={(e) => onChange({ ...form, streamKey: e.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mb-0.5 shrink-0"
              onClick={() => onChange({ ...form, streamKey: generateStreamKey(form.name) })}
            >
              Generate
            </Button>
          </div>
        </div>
      )}

      {!showStreamKeyField && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
          <p className="text-sm text-slate-200">Internal stream key</p>
          <p className="mt-1 break-all font-mono text-xs text-brand-300">
            {autoStreamKey || 'Enter a stream label to generate one'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            HydroFoil still assigns an internal stream key for routing and session tracking.
          </p>
        </div>
      )}

      {/* RTSP Protocol */}
      {form.ingestProtocol === 'rtsp' && (
        <div className="space-y-3 rounded-lg bg-slate-800/50 p-3">
          <p className="text-xs text-slate-400">
            Enter RTSP source details (typically from IP cameras or RTSP servers)
          </p>
          <TextInput
            label="Host / IP address"
            placeholder="192.168.1.100 or camera.example.com"
            value={(form.protocolConfig as RtspProtocolConfig)?.host || ''}
            onChange={(e) => handleProtocolConfigChange({ host: e.target.value })}
          />
          <TextInput
            label="Port (optional)"
            placeholder="554"
            type="number"
            value={(form.protocolConfig as RtspProtocolConfig)?.port?.toString() || ''}
            onChange={(e) =>
              handleProtocolConfigChange({
                port: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <TextInput
            label="Path (optional)"
            placeholder="/stream or /Streaming/Channels/101"
            value={(form.protocolConfig as RtspProtocolConfig)?.path || ''}
            onChange={(e) => handleProtocolConfigChange({ path: e.target.value })}
          />
          <TextInput
            label="Username (optional)"
            placeholder="admin"
            value={(form.protocolConfig as RtspProtocolConfig)?.username || ''}
            onChange={(e) => handleProtocolConfigChange({ username: e.target.value })}
          />
          <TextInput
            label="Password (optional)"
            placeholder="••••••••"
            type="password"
            value={(form.protocolConfig as RtspProtocolConfig)?.password || ''}
            onChange={(e) => handleProtocolConfigChange({ password: e.target.value })}
          />
        </div>
      )}

      {/* SRT Protocol */}
      {form.ingestProtocol === 'srt' && (
        <SrtConnectionFormFields
          variant="ingest"
          ingestAppName={appName}
          config={(form.protocolConfig as SrtProtocolConfig) ?? emptySrtConfig('caller')}
          onChange={(next) => onChange({ ...form, protocolConfig: next })}
          idPrefix="input-srt"
        />
      )}

      {/* Publish URL Display */}
      <div>
        <p className="hf-muted text-xs break-all">
          Publish URL:{' '}
          {publishUrl ? (
            <CopyableUrl
              url={publishUrl}
              className="inline text-xs max-w-full"
            />
          ) : (
            <span className="font-mono">—</span>
          )}
        </p>
      </div>
    </div>
  );
};

export const emptyInputForm = (): InputFormState => ({
  name: '',
  streamKey: '',
  ingestProtocol: 'rtmp',
  protocolConfig: undefined,
});
