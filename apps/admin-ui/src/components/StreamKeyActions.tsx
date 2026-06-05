import React from 'react';
import { Circle, Pencil } from 'lucide-react';

import type { Input } from '../api/types';
import { DeleteInputButton } from './DeleteInputButton';
import { IconActionButton } from './IconActionButton';
import { StreamMediaActions } from './StreamMediaActions';

export interface StreamKeyActionsProps {
  input: Input;
  appName: string;
  onPreview: () => void;
  onMonitor?: () => void;
  isPublishing?: boolean;
  onNotify?: (message: string) => void;
  onEdit: () => void;
  onRecord: () => void;
  onDeleted: () => Promise<void>;
}

/** Stream key row on Inputs: monitor, preview, embed, link, record, edit, delete */
export const StreamKeyActions: React.FC<StreamKeyActionsProps> = ({
  input,
  appName,
  onPreview,
  onMonitor,
  isPublishing,
  onNotify,
  onEdit,
  onRecord,
  onDeleted,
}) => (
  <div className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end">
    <StreamMediaActions
      inputId={input.id}
      target={{
        streamKey: input.streamKey,
        gatewayApp: appName,
        label: input.name,
        status: isPublishing ? 'publishing' : undefined,
      }}
      onPreview={onPreview}
      onMonitor={onMonitor}
      onNotify={onNotify}
    />
    <IconActionButton
      label="Record"
      icon={Circle}
      onClick={onRecord}
      variant="record"
      iconFill={input.enabled ? 'currentColor' : 'none'}
    />
    <IconActionButton label="Edit" icon={Pencil} onClick={onEdit} />
    <DeleteInputButton input={input} onDeleted={onDeleted} />
  </div>
);
