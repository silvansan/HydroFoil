import React from 'react';
import { Button, Modal } from '@hydrofoil/ui-kit';

import { FormError } from './FormError';
import type { Input } from '../api/types';
import { InputFormFields, type InputFormState } from './InputFormFields';

interface EditStreamKeyModalProps {
  isOpen: boolean;
  appName: string;
  form: InputFormState;
  enabled: boolean;
  submitError: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onChange: (form: InputFormState) => void;
  onEnabledChange: (enabled: boolean) => void;
  onSave: () => void;
}

export const EditStreamKeyModal: React.FC<EditStreamKeyModalProps> = ({
  isOpen,
  appName,
  form,
  enabled,
  submitError,
  isSubmitting,
  onClose,
  onChange,
  onEnabledChange,
  onSave,
}) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Edit stream key">
    <InputFormFields appName={appName} form={form} onChange={onChange} />
    <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onEnabledChange(e.target.checked)}
        className="rounded border-slate-600 text-brand-500"
      />
      Stream key enabled (accept publishes)
    </label>
    <p className="hf-muted text-xs mt-2">
      Changing the stream key updates ingest URLs. Update encoders and restream routes accordingly.
    </p>
    <div className="mt-3">
      <FormError message={submitError} />
    </div>
    <div className="flex justify-end gap-2 pt-4">
      <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={onSave}
        disabled={!form.name.trim() || !form.streamKey.trim() || isSubmitting}
      >
        {isSubmitting ? 'Saving…' : 'Save'}
      </Button>
    </div>
  </Modal>
);

export function inputToForm(input: Input): InputFormState {
  return {
    name: input.name,
    streamKey: input.streamKey,
    ingestProtocol: input.ingestProtocol,
  };
}
