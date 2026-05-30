import React from 'react';
import { Button, TextInput } from '@hydrofoil/ui-kit';

import type { Input } from '../api/types';
import { CopyableUrl } from './CopyableUrl';
import { generateStreamKey, rtmpIngestUrl } from '../lib/stream';

export interface InputFormState {
  name: string;
  streamKey: string;
  ingestProtocol: Input['ingestProtocol'];
}

interface InputFormFieldsProps {
  appName: string;
  form: InputFormState;
  onChange: (next: InputFormState) => void;
}

export const InputFormFields: React.FC<InputFormFieldsProps> = ({ appName, form, onChange }) => (
  <div className="space-y-4">
    <TextInput
      label="Stream label"
      placeholder="English feed"
      value={form.name}
      onChange={(e) => onChange({ ...form, name: e.target.value })}
    />
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
      <p className="hf-muted mt-2 text-xs break-all">
        Publish URL:{' '}
        {form.streamKey ? (
          <CopyableUrl
            url={rtmpIngestUrl(form.streamKey, appName)}
            className="inline text-xs max-w-full"
          />
        ) : (
          <span className="font-mono">—</span>
        )}
      </p>
    </div>
    <div>
      <label className="text-sm font-medium text-slate-300">Ingest protocol</label>
      <select
        className="hf-select mt-1"
        value={form.ingestProtocol}
        onChange={(e) =>
          onChange({
            ...form,
            ingestProtocol: e.target.value as Input['ingestProtocol'],
          })
        }
      >
        <option value="rtmp">RTMP</option>
        <option value="rtsp">RTSP</option>
        <option value="hls">HLS</option>
        <option value="http">HTTP</option>
      </select>
    </div>
  </div>
);

export const emptyInputForm = (): InputFormState => ({
  name: '',
  streamKey: generateStreamKey(),
  ingestProtocol: 'rtmp',
});
