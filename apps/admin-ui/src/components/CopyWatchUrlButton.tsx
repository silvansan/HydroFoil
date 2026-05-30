import React from 'react';
import { Link2 } from 'lucide-react';

import { absoluteHlsUrl } from '../lib/playback';
import { copyText } from '../lib/clipboard';

interface CopyWatchUrlButtonProps {
  streamKey: string;
  appName: string;
  onCopied?: (message: string) => void;
}

export const CopyWatchUrlButton: React.FC<CopyWatchUrlButtonProps> = ({
  streamKey,
  appName,
  onCopied,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const url = absoluteHlsUrl(streamKey, appName);
    const ok = await copyText(url);
    const message = ok ? 'Watch URL copied' : 'Copy failed';
    onCopied?.(message);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      title={copied ? 'Copied' : 'Copy HLS watch URL'}
      aria-label="Copy HLS watch URL"
      onClick={handleClick}
      className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-brand-300"
    >
      <Link2 size={16} />
    </button>
  );
};
