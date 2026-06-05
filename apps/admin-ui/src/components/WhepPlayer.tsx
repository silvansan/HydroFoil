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

/** Resolve SRS Location header for WHEP session teardown (avoid wrong /whip/ paths). */
function resolveWhepSessionUrl(location: string, _whepEndpoint: string): string {
  const normalized = location.replace(/\/whip\//gi, '/whep/');
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  const apiBase = (import.meta.env.VITE_SRS_API_BASE ?? '/srs-api').replace(/\/$/, '');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  if (path.startsWith(apiBase) || path.startsWith('/rtc/')) {
    return `${origin}${path}`;
  }
  return `${origin}${apiBase}${path}`;
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

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !endpoint) return;

    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let sessionUrl: string | null = null;

    const fail = (message: string) => {
      if (cancelled) return;
      setError(message);
      onError?.(message);
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
      if (sessionUrl) {
        fetch(sessionUrl, { method: 'DELETE' }).catch(() => undefined);
      }
      pc?.close();
      video.srcObject = null;
    };
  }, [endpoint, autoPlay, onError]);

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
