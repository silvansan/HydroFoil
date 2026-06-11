import React from 'react';

function parentOriginFromReferrer(): string | null {
  if (!document.referrer) {
    return null;
  }

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

/** Tell the parent page how tall the embed is so responsive iframes can resize. */
export function useEmbedResizeReporter(): void {
  React.useEffect(() => {
    const targetOrigin = parentOriginFromReferrer();

    const sendHeight = () => {
      if (!targetOrigin) {
        return;
      }

      const root = document.getElementById('root');
      const height = Math.ceil(root?.getBoundingClientRect().height ?? document.documentElement.scrollHeight);
      if (height > 0) {
        window.parent.postMessage({ type: 'hydrofoil-embed-resize', height }, targetOrigin);
      }
    };

    sendHeight();

    const root = document.getElementById('root');
    const observer = root ? new ResizeObserver(sendHeight) : null;
    if (root && observer) {
      observer.observe(root);
    }

    window.addEventListener('resize', sendHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sendHeight);
    };
  }, []);
}
