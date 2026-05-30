import React from 'react';

import { copyText } from '../lib/clipboard';

interface CopyableUrlProps {
  url: string;
  className?: string;
  onCopied?: (message: string) => void;
  copiedMessage?: string;
}

export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** HTTP(S): opens in a new tab. RTMP and others: click copies to clipboard. */
export const ClickableStreamUrl: React.FC<CopyableUrlProps> = (props) => {
  const { url, className = '' } = props;
  if (isWebUrl(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        onClick={(e) => e.stopPropagation()}
        className={`font-mono text-left break-all text-brand-400 hover:text-brand-300 underline-offset-2 hover:underline ${className}`}
      >
        {url}
      </a>
    );
  }
  return <CopyableUrl {...props} />;
};

/** Clickable URL text — copies to clipboard for pasting into encoders or tools. */
export const CopyableUrl: React.FC<CopyableUrlProps> = ({  url,
  className = '',
  onCopied,
  copiedMessage = 'Ingest URL copied — paste into your encoder',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ok = await copyText(url);
    const message = ok ? copiedMessage : 'Copy failed';
    onCopied?.(message);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? 'Copied!' : 'Click to copy'}
      className={`font-mono text-left truncate transition-colors cursor-pointer rounded px-1 -mx-1 underline-offset-2 hover:underline ${
        copied
          ? 'text-brand-300'
          : 'text-slate-500 hover:text-brand-300 hover:bg-brand-500/10'
      } ${className}`}
    >
      {url}
    </button>
  );
};
