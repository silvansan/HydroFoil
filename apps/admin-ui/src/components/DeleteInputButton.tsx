import React from 'react';
import { Trash2 } from 'lucide-react';

import type { Input } from '../api/types';
import { DeleteInputDialog } from './DeleteInputDialog';

interface DeleteInputButtonProps {
  input: Input;
  onDeleted: () => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const DeleteInputButton: React.FC<DeleteInputButtonProps> = ({
  input,
  onDeleted,
  disabled = false,
  size = 'sm',
  className = '',
}) => {
  const [open, setOpen] = React.useState(false);

  const pad = size === 'sm' ? 'p-2' : 'px-3 py-2';

  return (
    <>
      <button
        type="button"
        title={`Delete stream key ${input.name}`}
        aria-label={`Delete stream key ${input.name}`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) setOpen(true);
        }}
        className={`rounded-lg text-red-400/90 hover:bg-red-950/50 hover:text-red-300 disabled:opacity-40 ${pad} ${className}`}
      >
        <Trash2 size={size === 'sm' ? 16 : 18} />
      </button>

      <DeleteInputDialog
        input={input}
        isOpen={open}
        onClose={() => setOpen(false)}
        onDeleted={onDeleted}
      />
    </>
  );
};
