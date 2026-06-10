import React from 'react';

/** Tell the parent page how tall the embed is so responsive iframes can resize. */
export function useEmbedResizeReporter(): void {
  React.useEffect(() => {
    const sendHeight = () => {
      const root = document.getElementById('root');
      const height = Math.ceil(root?.getBoundingClientRect().height ?? document.documentElement.scrollHeight);
      if (height > 0) {
        window.parent.postMessage({ type: 'hydrofoil-embed-resize', height }, '*');
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
