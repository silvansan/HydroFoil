import React from 'react';
import { Circle, Code2, Link2, Pencil, Play, Trash2, Zap } from 'lucide-react';

import { IconActionButton } from './IconActionButton';
import { DeleteButton } from './DeleteButton';
import {
  canPreviewHls,
  embedCodeForTarget,
  hlsUrlForTarget,
  type StreamMediaTarget,
} from '../lib/stream-media';
import { copyText } from '../lib/clipboard';

export interface StreamMediaActionsProps {
  target: StreamMediaTarget;
  onPreview: () => void;
  /** Low-latency FLV monitor (live streams only). */
  onMonitor?: () => void;
  onNotify?: (message: string) => void;
  /** Show copy-link + embed (default true when HLS preview is available). */
  showShare?: boolean;
  /** Enable Play even without HLS (e.g. recordings before VOD URLs exist). */
  allowPreviewWithoutHls?: boolean;
  onRecord?: () => void;
  recordEnabled?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  deleteConfirm?: string;
}

/**
 * Standard media row actions: preview, embed, copy link, optional record / edit / delete.
 * Use on Inputs, Live Sessions, Restreaming (HLS paths), and Recordings when playable.
 */
export const StreamMediaActions: React.FC<StreamMediaActionsProps> = ({
  target,
  onPreview,
  onMonitor,
  onNotify,
  showShare = true,
  allowPreviewWithoutHls = false,
  onRecord,
  recordEnabled = true,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  deleteConfirm = 'Delete this item?',
}) => {
  const hasHls = canPreviewHls(target);
  const canPreview = hasHls || allowPreviewWithoutHls;
  const canShare = showShare && hasHls;

  const notify = (message: string) => onNotify?.(message);

  const copy = async (e: React.MouseEvent, text: string, success: string) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(text);
    notify(ok ? success : 'Copy failed');
  };

  const isLive = target.status === 'publishing';
  const canMonitor = Boolean(onMonitor && isLive);

  return (
    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      {canMonitor && (
        <IconActionButton
          label="Monitor (low latency)"
          icon={Zap}
          onClick={() => onMonitor!()}
        />
      )}
      <IconActionButton
        label={canPreview ? 'Preview (HLS / embed)' : 'Preview unavailable'}
        icon={Play}
        onClick={() => onPreview()}
        disabled={!canPreview}
        iconFill="currentColor"
      />
      {canShare && (
        <>
          <IconActionButton
            label="Copy embed code"
            icon={Code2}
            onClick={(e) => copy(e, embedCodeForTarget(target), 'Embed code copied')}
          />
          <IconActionButton
            label="Copy HLS link"
            icon={Link2}
            onClick={(e) => copy(e, hlsUrlForTarget(target), 'HLS link copied')}
          />
        </>
      )}
      {onRecord && (
        <IconActionButton
          label="Record"
          icon={Circle}
          onClick={onRecord}
          variant="record"
          iconFill={recordEnabled ? 'currentColor' : 'none'}
        />
      )}
      {onEdit && (
        <IconActionButton label="Edit" icon={Pencil} onClick={onEdit} />
      )}
      {onDelete &&
        (deleteConfirm ? (
          <DeleteButton
            label={deleteLabel}
            confirmTitle={deleteLabel}
            confirmMessage={deleteConfirm}
            onDelete={onDelete}
          />
        ) : (
          <IconActionButton
            label={deleteLabel}
            icon={Trash2}
            onClick={() => onDelete()}
            variant="danger"
          />
        ))}
    </div>
  );
};
