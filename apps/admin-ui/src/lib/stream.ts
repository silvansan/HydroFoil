import type { RtspProtocolConfig, SrtProtocolConfig } from '../api/types';
import {
  publicAppOrigin,
  rtmpIngestBase,
  srtIngestHost,
  srtIngestPort,
} from './operator-urls';
const RTSP_PORT = 554;

/** SRS SRT publish streamid — maps to RTMP app/stream (restream push). */
export function buildSrtPublishStreamId(app: string, streamKey: string): string {
  const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
  const safeStream = streamKey.replace(/^\/+|\/+$/g, '');
  return `#!::r=${safeApp}/${safeStream},m=publish`;
}

function appendSrtPushQuery(baseUrl: string, latencyMs?: number): string {
  if (latencyMs == null || latencyMs < 0 || Number.isNaN(latencyMs)) {
    return baseUrl;
  }
  const params = new URLSearchParams();
  params.set('latency', String(Math.round(latencyMs)));
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${params.toString()}`;
}

export function usesGeneratedStreamKey(protocol: string): boolean {
  return protocol === 'rtsp' || protocol === 'srt';
}

export function generateStreamKey(name?: string): string {
  const slug = (name ?? 'stream')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 8);
  return slug ? `${slug}-${suffix}` : suffix;
}

export function rtmpIngestUrl(streamKey: string, app = 'live'): string {
  return `${rtmpIngestBase()}/${app}/${streamKey}`;
}

export function rtspIngestUrl(config?: RtspProtocolConfig): string {
  if (!config?.host?.trim()) {
    return '';
  }

  const protocol = 'rtsp';
  const host = config.host.trim();
  const port = config.port || RTSP_PORT;
  const path = config.path ? config.path.replace(/^\/+/, '') : 'stream';

  let auth = '';
  if (config.username) {
    const password = config.password || '';
    auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(password)}@`;
  }

  return `${protocol}://${auth}${host}:${port}/${path}`;
}

export function srtIngestUrl(config?: SrtProtocolConfig | string, app = 'live'): string {
  // Support both new config object and legacy string (streamKey) format
  if (typeof config === 'string') {
    // Legacy format: srtIngestUrl(streamKey, app)
    const streamKey = config;
    const safeApp = app.replace(/^\/+|\/+$/g, '') || 'live';
    const safeStream = streamKey.replace(/^\/+|\/+$/g, '');
    const streamid = `#!::r=${safeApp}/${safeStream},m=publish`;
    const host = srtIngestHost();
    const hostPart = host.includes(':') ? `[${host}]` : host;
    return `srt://${hostPart}:${srtIngestPort()}?streamid=${encodeURIComponent(streamid)}`;
  }

  // New config object format
  if (!config?.host?.trim()) {
    return '';
  }

  const host = config.host.trim();
  const port = config.port || srtIngestPort();
  const mode = config.mode || 'caller';
  const streamid = config.streamid || 'stream';

  let auth = '';
  if (config.username) {
    const password = config.password || '';
    auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(password)}@`;
  }

  const hostPart = host.includes(':') ? `[${host}]` : host;
  const params = new URLSearchParams();
  params.set('mode', mode);
  params.set('streamid', streamid);
  if (config.encryptionKey) {
    params.set('passphrase', config.encryptionKey);
  }

  return `srt://${auth}${hostPart}:${port}?${params.toString()}`;
}

export function emptySrtConfig(mode: SrtProtocolConfig['mode'] = 'caller'): SrtProtocolConfig {
  return {
    mode,
    host: '',
    port: undefined,
    streamid: '',
    username: '',
    password: '',
    encryptionKey: '',
  };
}

export function canSubmitSrtConfig(config: SrtProtocolConfig): boolean {
  const mode = config.mode || 'caller';
  if (mode === 'listener') {
    return Boolean(config.port);
  }
  return Boolean(config.host?.trim());
}

/** Build srt:// URL for ingest or FFmpeg SRT push (before optional latency append). */
export function buildSrtConnectionUrl(
  config: SrtProtocolConfig,
  direction: 'ingest' | 'push' = 'ingest'
): string {
  const mode = config.mode || 'caller';
  const port = config.port || srtIngestPort();
  const params = new URLSearchParams();
  params.set('mode', mode);
  if (config.streamid?.trim()) {
    params.set('streamid', config.streamid.trim());
  }
  if (config.encryptionKey?.trim()) {
    params.set('passphrase', config.encryptionKey.trim());
  }

  if (mode === 'listener') {
    if (direction === 'push') {
      const qs = params.toString();
      return `srt://:${port}${qs ? `?${qs}` : ''}`;
    }
    const host = srtIngestHost();
    const hostPart = host.includes(':') ? `[${host}]` : host;
    let auth = '';
    if (config.username) {
      const password = config.password || '';
      auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(password)}@`;
    }
    const qs = params.toString();
    return `srt://${auth}${hostPart}:${port}${qs ? `?${qs}` : ''}`;
  }

  if (!config.host?.trim()) {
    return '';
  }

  return srtIngestUrl(config);
}

export function finalizeSrtPushUrl(config: SrtProtocolConfig, latencyMs?: number): string {
  const base = buildSrtConnectionUrl(config, 'push');
  if (!base) return '';
  if (latencyMs == null || Number.isNaN(latencyMs) || latencyMs < 0) {
    return base;
  }
  return appendSrtPushQuery(base, Math.round(latencyMs));
}

export function parseSrtLatencyMs(url: string): number | undefined {
  try {
    const parsed = new URL(url.trim());
    const raw = parsed.searchParams.get('latency');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function parseSrtIngestUrl(url: string): SrtProtocolConfig | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'srt:' || !parsed.hostname) {
      return null;
    }

    const params = new URLSearchParams(parsed.search);
    let streamid = params.get('streamid') || undefined;
    if (!streamid && parsed.hash.startsWith('#!::')) {
      streamid = parsed.hash.slice(1);
    }

    const modeParam = params.get('mode') as SrtProtocolConfig['mode'] | null;
    const mode =
      modeParam ||
      (parsed.hostname ? 'caller' : parsed.port ? 'listener' : undefined);

    return {
      host: parsed.hostname || undefined,
      port: parsed.port ? Number(parsed.port) : undefined,
      mode,
      streamid,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      encryptionKey: params.get('passphrase') || undefined,
    };
  } catch {
    return null;
  }
}

export function ingestProtocolDisplayLabel(protocol: string): string {
  const labels: Record<string, string> = {
    rtmp: 'RTMP',
    rtsp: 'RTSP',
    srt: 'SRT',
    hls: 'HLS',
    http: 'HTTP',
  };
  const name = labels[protocol] ?? protocol.toUpperCase();
  return `${name} ingest`;
}

export function ingestUrlForInput(
  input: {
    ingestProtocol: string;
    streamKey: string;
    protocolConfig?: RtspProtocolConfig | SrtProtocolConfig;
  },
  appName = 'live'
): string {
  const url = generateIngestUrl(
    input.ingestProtocol,
    input.streamKey,
    input.protocolConfig,
    appName
  );
  if (url) {
    return url;
  }
  if (input.ingestProtocol === 'srt') {
    return srtIngestUrl(input.streamKey, appName);
  }
  return '';
}

export function generateIngestUrl(
  protocol: string,
  streamKey?: string,
  config?: RtspProtocolConfig | SrtProtocolConfig,
  app = 'live'
): string {
  switch (protocol) {
    case 'rtmp':
      return rtmpIngestUrl(streamKey || '', app);
    case 'rtsp':
      return rtspIngestUrl(config as RtspProtocolConfig);
    case 'srt': {
      if (config) {
        const built = buildSrtConnectionUrl(config as SrtProtocolConfig, 'ingest');
        if (built) return built;
      }
      return srtIngestUrl(config as SrtProtocolConfig);
    }
    case 'hls': {
      const origin = publicAppOrigin();
      const path = `/${app}/${streamKey || 'stream'}.m3u8`;
      return origin ? `${origin}/live${path}` : `http://localhost:8080${path}`;
    }
    case 'http': {
      const origin = publicAppOrigin();
      const path = `/${app}/${streamKey || 'stream'}`;
      return origin ? `${origin}/live${path}` : `http://localhost:8080${path}`;
    }
    default:
      return '';
  }
}

export function resolveInputStreamKey(
  name: string,
  protocol: string,
  streamKey?: string
): string {
  const trimmed = streamKey?.trim() ?? '';
  if (trimmed) {
    return trimmed;
  }

  return usesGeneratedStreamKey(protocol) ? generateStreamKey(name) : '';
}

export function canSubmitInputForm(params: {
  name: string;
  ingestProtocol: string;
  streamKey?: string;
  protocolConfig?: RtspProtocolConfig | SrtProtocolConfig;
}): boolean {
  if (!params.name.trim()) {
    return false;
  }

  if (usesGeneratedStreamKey(params.ingestProtocol)) {
    return Boolean(params.protocolConfig?.host?.trim());
  }

  return Boolean(params.streamKey?.trim());
}

export function suggestPlaybackTarget(
  protocol: string,
  app: string,
  stream: string
): string {
  const safeApp = app || 'live';
  const safeStream = stream || '{stream}';
  switch (protocol) {
    case 'hls': {
      const origin = publicAppOrigin();
      const path = `/${safeApp}/${safeStream}.m3u8`;
      return origin ? `${origin}/live${path}` : `http://localhost:8080${path}`;
    }
    case 'http-flv': {
      const origin = publicAppOrigin();
      const path = `/${safeApp}/${safeStream}.flv`;
      return origin ? `${origin}/live${path}` : `http://localhost:8080${path}`;
    }
    case 'rtmp':
      return `${rtmpIngestBase()}/${safeApp}/${safeStream}`;
    default:
      return `/${safeApp}/${safeStream}`;
  }
}
