import React from 'react';

import { DeleteButton } from './DeleteButton';
import { PlayButton } from './PlayButton';
import { ToggleEnabledButton } from './ToggleEnabledButton';

export interface RowActionsProps {
  name: string;
  enabled?: boolean;
  onToggle?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  deleteConfirm?: string;
  deleteTitle?: string;
  onPlay?: (e: React.MouseEvent) => void;
  playLabel?: string;
  playDisabled?: boolean;
}

/** Standard inline actions: play (optional), enable/disable, delete */
export const RowActions: React.FC<RowActionsProps> = ({
  name,
  enabled,
  onToggle,
  onDelete,
  deleteConfirm,
  deleteTitle,
  onPlay,
  playLabel = 'Watch',
  playDisabled,
}) => (
  <div className="flex items-center gap-1 shrink-0">
    {onPlay && (
      <PlayButton label={playLabel} disabled={playDisabled} onClick={onPlay} />
    )}
    {onToggle !== undefined && enabled !== undefined && (
      <ToggleEnabledButton enabled={enabled} name={name} onToggle={onToggle} />
    )}
    {onDelete && (
      <DeleteButton
        label={`Delete ${name}`}
        confirmTitle={deleteTitle ?? `Delete ${name}?`}
        confirmMessage={deleteConfirm ?? `This will permanently remove "${name}". This cannot be undone.`}
        onDelete={onDelete}
      />
    )}
  </div>
);
