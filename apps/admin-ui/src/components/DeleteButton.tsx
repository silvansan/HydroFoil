import React from 'react';
import { Trash2 } from 'lucide-react';

import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { errorMessage } from '../lib/api-error';

interface DeleteButtonProps {
  label: string;
  confirmMessage: string;
  confirmTitle?: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const DeleteButton: React.FC<DeleteButtonProps> = ({
  label,
  confirmMessage,
  confirmTitle,
  onDelete,
  disabled = false,
  size = 'sm',
  className = '',
}) => {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || busy) return;
    setError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err, 'Delete failed. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const pad = size === 'sm' ? 'p-2' : 'px-3 py-2';
  const title = confirmTitle ?? 'Confirm delete';

  return (
    <>
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled || busy}
        onClick={openDialog}
        className={`rounded-lg text-red-400/90 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-40 ${pad} ${className}`}
      >
        <Trash2 size={size === 'sm' ? 16 : 18} />
      </button>

      <DeleteConfirmDialog
        isOpen={open}
        title={title}
        message={confirmMessage}
        isDeleting={busy}
        error={error}
        onCancel={closeDialog}
        onConfirm={handleConfirm}
      />
    </>
  );
};
