import axios from 'axios';
import pino from 'pino';

import { config } from '../config';

const logger = pino({ name: 'srs-publisher-stats' });

export interface SrsPublisherStats {
  streamPath: string;
  publisherIp?: string;
  sourceProtocol?: string;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  resolution?: string;
  uptimeSeconds?: number;
}

interface SrsStreamRow {
  id?: string;
  name?: string;
  app?: string;
  url?: string;
  publish?: { active?: boolean; cid?: string };
  kbps?: { recv_30s?: number; send_30s?: number };
  video?: { codec?: string; profile?: string; level?: string; width?: number; height?: number };
  audio?: { codec?: string; profile?: string; sample_rate?: number; channel?: number };
}

interface SrsClientRow {
  id?: string;
  stream?: string;
  ip?: string;
  type?: string;
  publish?: boolean;
  alive?: number;
  recv_bytes?: number;
  kbps?: { recv_30s?: number };
}

function resolveBitrateKbps(
  recv30s?: number,
  recvBytes?: number,
  aliveSeconds?: number
): number | undefined {
  if (typeof recv30s === 'number' && recv30s > 0) {
    return Math.round(recv30s);
  }
  if (recvBytes && aliveSeconds && aliveSeconds > 1) {
    return Math.round((recvBytes * 8) / 1000 / aliveSeconds);
  }
  return undefined;
}

function normalizeApp(app?: string): string {
  return (app ?? 'live').replace(/^\/+|\/+$/g, '');
}

function ingestKey(app: string, streamKey: string): string {
  return `${app}/${streamKey}`;
}

function formatSourceProtocol(clientType?: string): string | undefined {
  if (!clientType) return undefined;
  const t = clientType.toLowerCase();
  if (t.includes('rtmp') || t.includes('fmle') || t.includes('flash')) return 'RTMP';
  if (t.includes('srt')) return 'SRT';
  if (t.includes('rtc') || t.includes('webrtc')) return 'WebRTC';
  if (t.includes('mpegts') || t.includes('ts')) return 'MPEG-TS';
  if (t.includes('flv')) return 'FLV';
  return clientType.replace(/-/g, ' ').toUpperCase();
}

function formatVideoCodec(video?: SrsStreamRow['video']): string | undefined {
  if (!video?.codec) return undefined;
  const parts = [video.codec];
  if (video.profile) parts.push(video.profile);
  if (video.level) parts.push(`L${video.level}`);
  return parts.join(' ');
}

function formatAudioCodec(audio?: SrsStreamRow['audio']): string | undefined {
  if (!audio?.codec) return undefined;
  const parts = [audio.codec];
  if (audio.profile) parts.push(audio.profile);
  return parts.join(' ');
}

/** Live publisher telemetry keyed by `{gatewayApp}/{streamKey}`. */
export async function fetchSrsPublisherStatsByIngest(): Promise<Map<string, SrsPublisherStats>> {
  const result = new Map<string, SrsPublisherStats>();

  try {
    const [streamsRes, clientsRes] = await Promise.all([
      axios.get(`${config.srsHttpApiUrl}/api/v1/streams/`, { timeout: 5000 }),
      axios.get(`${config.srsHttpApiUrl}/api/v1/clients/`, { timeout: 5000 }),
    ]);

    const streams: SrsStreamRow[] = streamsRes.data?.streams ?? [];
    const clients: SrsClientRow[] = clientsRes.data?.clients ?? [];

    const publisherByStreamId = new Map<string, SrsClientRow>();
    for (const client of clients) {
      if (client.publish && client.stream) {
        publisherByStreamId.set(client.stream, client);
      }
    }

    for (const stream of streams) {
      if (stream.publish?.active === false) continue;
      const app = normalizeApp(stream.app);
      const streamKey = stream.name ?? '';
      if (!streamKey) continue;

      const publisher = stream.id ? publisherByStreamId.get(stream.id) : undefined;
      const aliveSeconds =
        typeof publisher?.alive === 'number' ? Math.floor(publisher.alive) : undefined;
      const bitrateKbps = resolveBitrateKbps(
        stream.kbps?.recv_30s ?? publisher?.kbps?.recv_30s,
        publisher?.recv_bytes,
        aliveSeconds
      );
      const width = stream.video?.width;
      const height = stream.video?.height;

      result.set(ingestKey(app, streamKey), {
        streamPath: stream.url ?? `/${app}/${streamKey}`,
        publisherIp: publisher?.ip,
        sourceProtocol: formatSourceProtocol(publisher?.type),
        videoCodec: formatVideoCodec(stream.video),
        audioCodec: formatAudioCodec(stream.audio),
        bitrateKbps,
        resolution: width && height ? `${width}x${height}` : undefined,
        uptimeSeconds: aliveSeconds,
      });
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to fetch SRS publisher stats');
  }

  return result;
}

export function publisherStatsForSession(
  statsByIngest: Map<string, SrsPublisherStats>,
  gatewayApp: string | undefined,
  streamKey: string
): SrsPublisherStats | undefined {
  return statsByIngest.get(ingestKey(normalizeApp(gatewayApp), streamKey));
}
