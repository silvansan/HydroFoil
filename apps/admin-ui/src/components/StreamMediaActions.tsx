import React from 'react';
import { Circle, Code2, Link2, Pencil, Play, Radio, Trash2 } from 'lucide-react';

import { IconActionButton } from './IconActionButton';
import { DeleteButton } from './DeleteButton';
import {
  canPreviewHls,
  embedCodeForTarget,
  hlsUrlForTarget,
  type StreamMediaTarget,
} from '../lib/stream-media';
import { api } from '../api/client';
import { copyText } from '../lib/clipboard';
import { rtmpMonitorUrl } from '../lib/playback';
import { useInputPlaybackShare } from '../hooks/useInputPlaybackShare';

export interface StreamMediaActionsProps {
  target: StreamMediaTarget;
  /** When set, copy/embed actions use policy-aware URLs from the API. */
  inputId?: string;
  onPreview: () => void;
  /** Low-latency WebRTC monitor (live streams only). */
  onMonitor?: () => void;
  onNotify?: (message: string) => void;
  showShare?: boolean;
  /** Show HLS copy/embed actions while live (ingest or output path). */
  showLiveWebShare?: boolean;
  /** RTMP play URL to copy for live streams (VLC / vMix). */
  rtmpPlayUrl?: string;
  allowPreviewWithoutHls?: boolean;
  onRecord?: () => void;
  recordEnabled?: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  deleteConfirm?: string;
}

export const StreamMediaActions: React.FC<StreamMediaActionsProps> = ({
  target,
  inputId,
  onPreview,
  onMonitor,
  onNotify,
  showShare = true,
  showLiveWebShare,
  rtmpPlayUrl: rtmpPlayUrlProp,
  allowPreviewWithoutHls = false,
  onRecord,
  recordEnabled = true,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  deleteConfirm = 'Delete this item?',
}) => {
  const isLive = target.status === 'publishing';
  const { share: playbackShare } = useInputPlaybackShare(inputId && isLive ? inputId : undefined);
  const mediaTarget: StreamMediaTarget = {
    ...target,
    playbackShare: target.playbackShare ?? playbackShare,
  };
  const hasHls = canPreviewHls(mediaTarget);
  const canMonitor = Boolean(onMonitor && isLive);
  const canPreview = hasHls || allowPreviewWithoutHls || canMonitor;
  const liveWebShare = showLiveWebShare ?? isLive;
  const rtmpPlayUrl =
    rtmpPlayUrlProp ??
    (isLive ? rtmpMonitorUrl(target.streamKey, target.gatewayApp) : undefined);
  const canShare = (showShare && hasHls && !isLive) || (liveWebShare && hasHls);
  const canCopyRtmp = Boolean(isLive && rtmpPlayUrl);

  const notify = (message: string) => onNotify?.(message);

  const resolveShareForCopy = React.useCallback(async (): Promise<StreamMediaTarget> => {
    if (mediaTarget.playbackShare || !inputId) {
      return mediaTarget;
    }
    try {
      const share = await api.getInputPlaybackUrl(inputId);
      return { ...mediaTarget, playbackShare: share };
    } catch {
      return mediaTarget;
    }
  }, [mediaTarget, inputId]);

  const copy = async (e: React.MouseEvent, text: string, success: string) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(text);
    notify(ok ? success : 'Copy failed');
  };

  const copyEmbed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const resolved = await resolveShareForCopy();
    const ok = await copyText(embedCodeForTarget(resolved));
    notify(ok ? 'Embed code copied' : 'Copy failed');
  };

  const copyHls = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const resolved = await resolveShareForCopy();
    const ok = await copyText(hlsUrlForTarget(resolved));
    notify(ok ? 'HLS link copied' : 'Copy failed');
  };

  const openPlayback = () => {
    if (canMonitor && onMonitor) {
      onMonitor();
      return;
    }
    onPreview();
  };

  return (
    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <IconActionButton
        label={canMonitor ? 'Play (WebRTC)' : canPreview ? 'Preview' : 'Preview unavailable'}
        icon={Play}
        onClick={openPlayback}
        disabled={!canPreview}
        iconFill="currentColor"
      />
      {canCopyRtmp && (
        <IconActionButton
          label="Copy RTMP play URL"
          icon={Radio}
          onClick={(e) => copy(e, rtmpPlayUrl!, 'RTMP play URL copied')}
        />
      )}
      {canShare && (
        <>
          <IconActionButton
            label="Copy embed code"
            icon={Code2}
            onClick={copyEmbed}
          />
          <IconActionButton
            label="Copy HLS link"
            icon={Link2}
            onClick={copyHls}
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
      {onEdit && <IconActionButton label="Edit" icon={Pencil} onClick={onEdit} />}
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
