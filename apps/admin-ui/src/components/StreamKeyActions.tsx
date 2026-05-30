import React from 'react';

import type { Input } from '../api/types';
import { DeleteInputButton } from './DeleteInputButton';
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
  <>
    <StreamMediaActions
      target={{
        streamKey: input.streamKey,
        gatewayApp: appName,
        label: input.name,
        status: isPublishing ? 'publishing' : undefined,
      }}
      onPreview={onPreview}
      onMonitor={onMonitor}
      onNotify={onNotify}
      onRecord={onRecord}
      recordEnabled={input.enabled}
      onEdit={onEdit}
    />
    <DeleteInputButton input={input} onDeleted={onDeleted} />
  </>
);
