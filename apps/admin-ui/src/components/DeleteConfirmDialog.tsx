import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from '@hydrofoil/ui-kit';

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  title = 'Confirm delete',
  message,
  confirmLabel = 'Delete',
  isDeleting = false,
  error,
  onCancel,
  onConfirm,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isDeleting, onCancel]);

  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-message"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <Card
        className="relative w-full max-w-md shadow-hydro border-red-500/25"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5 space-y-4">
          <div className="flex gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-950/60 border border-red-500/35"
              aria-hidden
            >
              <AlertTriangle className="text-red-400" size={22} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2 id="delete-dialog-title" className="text-lg font-semibold text-slate-100">
                {title}
              </h2>
              <p id="delete-dialog-message" className="mt-2 text-sm text-slate-400 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isDeleting}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isDeleting}
              onClick={onConfirm}
            >
              {isDeleting ? 'Deleting…' : confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
};
