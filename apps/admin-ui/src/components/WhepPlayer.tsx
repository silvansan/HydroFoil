import React from 'react';

interface WhepPlayerProps {
  endpoint: string;
  className?: string;
  autoPlay?: boolean;
  onError?: (message: string) => void;
}

function iceServersFromEnv(): RTCIceServer[] {
  const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
  if (!raw) return [{ urls: 'stun:stun.l.google.com:19302' }];
  return raw
    .split(',')
    .map((url: string) => url.trim())
    .filter(Boolean)
    .map((url: string) => ({ urls: url }));
}

/** Resolve SRS Location header for WHEP session teardown (must use /srs-api proxy path). */
function resolveWhepSessionUrl(location: string, whepEndpoint: string): string {
  const normalized = location.replace(/\/whip\//gi, '/whep/');
  const apiBase = (import.meta.env.VITE_SRS_API_BASE ?? '/srs-api').replace(/\/$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const url = new URL(normalized);
      if (url.pathname.startsWith('/rtc/') && !url.pathname.startsWith(`${apiBase}/`)) {
        return `${origin}${apiBase}${url.pathname}${url.search}`;
      }
    } catch {
      return normalized;
    }
    return normalized;
  }

  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  if (path.startsWith(`${apiBase}/`)) {
    return `${origin}${path}`;
  }
  if (path.startsWith('/rtc/')) {
    return `${origin}${apiBase}${path}`;
  }

  try {
    return new URL(path, whepEndpoint.startsWith('http') ? whepEndpoint : `${origin}${whepEndpoint}`)
      .href;
  } catch {
    return `${origin}${apiBase}${path}`;
  }
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 3000);
  });
}

/** SRS WHEP subscriber (~0.5–2s latency). POST SDP offer to /rtc/v1/whep/ endpoint. */
export const WhepPlayer: React.FC<WhepPlayerProps> = ({
  endpoint,
  className = '',
  autoPlay = true,
  onError,
}) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !endpoint) return;

    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let sessionUrl: string | null = null;

    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      onErrorRef.current?.(message);
    };

    (async () => {
      try {
        setError(null);
        pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() });
        const remoteStream = new MediaStream();
        pc.ontrack = (ev) => {
          remoteStream.addTrack(ev.track);
          video.srcObject = remoteStream;
          if (autoPlay) video.play().catch(() => undefined);
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp ?? offer.sdp,
        });

        if (!response.ok) {
          throw new Error(`WHEP signaling failed (${response.status})`);
        }

        const location = response.headers.get('Location');
        if (location) sessionUrl = resolveWhepSessionUrl(location, endpoint);

        const answerSdp = await response.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err) {
        fail(err instanceof Error ? err.message : 'WHEP connection failed');
        pc?.close();
        pc = null;
      }
    })();

    return () => {
      cancelled = true;
      const teardownUrl = sessionUrl;
      if (teardownUrl) {
        fetch(teardownUrl, { method: 'DELETE' }).catch(() => undefined);
      }
      pc?.close();
      video.srcObject = null;
    };
  }, [endpoint, autoPlay]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className={className}
        controls
        playsInline
        muted
        autoPlay={autoPlay}
        style={{ width: '100%', background: '#000', borderRadius: '0.5rem' }}
      />
      {error && (
        <p className="absolute bottom-2 left-2 right-2 rounded bg-red-950/90 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
};
