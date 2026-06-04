import React from 'react';
import mpegts from 'mpegts.js';

interface FlvPlayerProps {
  src: string;
  className?: string;
  autoPlay?: boolean;
  /** Live monitor (HTTP-FLV from SRS) vs VOD recording. */
  isLive?: boolean;
}

function resolvePlayerUrl(src: string): string {
  if (!src || src.startsWith('http://') || src.startsWith('https://')) return src;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`;
  }
  return src;
}

/** HTTP-FLV player (SRS http_remux live monitor or VOD .flv). */
export const FlvPlayer: React.FC<FlvPlayerProps> = ({
  src,
  className = '',
  autoPlay = true,
  isLive = true,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const playUrl = React.useMemo(() => resolvePlayerUrl(src), [src]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl) return;

    setError(null);

    if (!mpegts.isSupported()) {
      setError('HTTP-FLV is not supported in this browser.');
      return;
    }

    const player = mpegts.createPlayer(
      {
        type: 'flv',
        url: playUrl,
        isLive: isLive,
        hasAudio: true,
        hasVideo: true,
      },
      {
        enableWorker: true,
        enableStashBuffer: false,
        stashInitialSize: 128,
        lazyLoad: false,
      }
    );

    player.attachMediaElement(video);
    player.load();
    if (autoPlay) {
      player.play().catch(() => undefined);
    }

    const onError = () => {
      setError(
        isLive
          ? 'Could not load FLV stream. Is the encoder still publishing?'
          : 'Could not load recording. It may still be uploading to storage.'
      );
    };
    player.on(mpegts.Events.ERROR, onError);

    return () => {
      player.off(mpegts.Events.ERROR, onError);
      player.pause();
      player.unload();
      player.detachMediaElement();
      player.destroy();
    };
  }, [playUrl, autoPlay, isLive]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className={className}
        controls
        playsInline
        muted
        style={{ width: '100%', background: '#000', borderRadius: '0.5rem' }}
      />
      {error && (
        <p className="absolute bottom-2 left-2 right-2 rounded bg-red-950/90 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {isLive ? 'Monitor mode — lower latency than HLS (~2–5s)' : 'VOD recording (HTTP-FLV)'}
      </p>
    </div>
  );
};
