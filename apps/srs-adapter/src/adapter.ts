import type { SRSDesiredConfig } from '@hydrofoil/domain';
import { countTranscodeIngests } from '@hydrofoil/domain';
import axios from 'axios';
import type { GatewayRuntimeApplyResult } from '@hydrofoil/db';

export interface SRSStreamSummary {
  id: string;
  name: string;
  vhost: string;
  app: string;
  live_ms: number;
  clients: number;
}

export interface DesiredIngestRuntimeStatus {
  routeId: string;
  inputId: string;
  app: string;
  streamKey: string;
  active: boolean;
}

export interface ActiveStreamRuntimeStatus {
  id: string;
  app: string;
  streamKey: string;
  managed: boolean;
  clients: number;
  liveMs: number;
}

export interface SRSRuntimeDriftSummary {
  desiredIngests: DesiredIngestRuntimeStatus[];
  activeStreams: ActiveStreamRuntimeStatus[];
  activeDesiredIngestCount: number;
  inactiveDesiredIngestCount: number;
  unmanagedActiveStreamCount: number;
}

export interface SRSDvrApplyTarget {
  gatewayApp: string;
  streamKey: string;
  vhosts?: string[];
}

export interface SRSDvrApplyResult {
  ok: boolean;
  command: 'start' | 'stop';
  app: string;
  stream: string;
  vhost?: string;
  attempts: Array<{ vhost: string; ok: boolean; error?: string }>;
}

export interface SRSTranscodeRuntimeSummary {
  required: boolean;
  ingestCount: number;
  engines: Array<{
    routeId: string;
    inputId: string;
    app: string;
    streamKey: string;
    engineCount: number;
    gatewayMapping: unknown;
  }>;
  applyMode: 'static-config-required';
  supported: false;
  note: string;
}

const DEFAULT_DVR_VHOSTS = ['localhost', '__defaultVhost__'];

function streamIdentity(app: string, streamKey: string): string {
  return `${app}/${streamKey}`;
}

function normalizePathPart(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function transcodeSummary(desired: SRSDesiredConfig): SRSTranscodeRuntimeSummary {
  const engines = desired.ingests
    .filter((ingest) => ingest.profile?.mode === 'transcode')
    .map((ingest) => ({
      routeId: ingest.routeId,
      inputId: ingest.inputId,
      app: ingest.app,
      streamKey: ingest.streamKey,
      engineCount: Array.isArray(
        (ingest.profile?.gatewayMapping as { srsTranscode?: { engines?: unknown[] } } | undefined)
          ?.srsTranscode?.engines
      )
        ? ((ingest.profile?.gatewayMapping as { srsTranscode?: { engines?: unknown[] } }).srsTranscode
            ?.engines?.length ?? 0)
        : 0,
      gatewayMapping: ingest.profile?.gatewayMapping,
    }));

  return {
    required: engines.length > 0,
    ingestCount: engines.length,
    engines,
    applyMode: 'static-config-required',
    supported: false,
    note:
      engines.length > 0
        ? 'SRS transcode mappings are present, but this adapter does not hot-apply transcode config; render these as srs.conf fragments and reload SRS deliberately.'
        : 'No SRS transcode mappings in desired gateway state.',
  };
}

export function summarizeRuntimeDrift(
  desired: SRSDesiredConfig,
  activeStreams: SRSStreamSummary[]
): SRSRuntimeDriftSummary {
  const activeIdentities = new Set(
    activeStreams.map((stream) => streamIdentity(stream.app, stream.name))
  );
  const desiredIdentities = new Set(
    desired.ingests.map((ingest) => streamIdentity(ingest.app, ingest.streamKey))
  );

  const desiredIngests = desired.ingests.map((ingest) => ({
    routeId: ingest.routeId,
    inputId: ingest.inputId,
    app: ingest.app,
    streamKey: ingest.streamKey,
    active: activeIdentities.has(streamIdentity(ingest.app, ingest.streamKey)),
  }));

  const activeRuntimeStreams = activeStreams.map((stream) => ({
    id: stream.id,
    app: stream.app,
    streamKey: stream.name,
    managed: desiredIdentities.has(streamIdentity(stream.app, stream.name)),
    clients: stream.clients,
    liveMs: stream.live_ms,
  }));

  return {
    desiredIngests,
    activeStreams: activeRuntimeStreams,
    activeDesiredIngestCount: desiredIngests.filter((ingest) => ingest.active).length,
    inactiveDesiredIngestCount: desiredIngests.filter((ingest) => !ingest.active).length,
    unmanagedActiveStreamCount: activeRuntimeStreams.filter((stream) => !stream.managed).length,
  };
}

/**
 * Only component that should call SRS HTTP API for gateway apply/read.
 */
export class SRSAdapter {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly webhookSecret: string = ''
  ) {}

  async getVersion(): Promise<unknown> {
    const response = await axios.get(`${this.apiBaseUrl}/api/v1/versions`);
    return response.data;
  }

  async listStreams(): Promise<SRSStreamSummary[]> {
    const response = await axios.get(`${this.apiBaseUrl}/api/v1/streams/`);
    const streams = response.data?.streams;
    return Array.isArray(streams) ? streams : [];
  }

  private async runRawCommand(params: Record<string, string>): Promise<unknown> {
    const response = await axios.post(`${this.apiBaseUrl}/api/v1/raw`, null, {
      params,
      timeout: 5000,
    });
    return response.data;
  }

  async applyDvrCommand(
    command: 'start' | 'stop',
    target: SRSDvrApplyTarget
  ): Promise<SRSDvrApplyResult> {
    const app = normalizePathPart(target.gatewayApp);
    const stream = normalizePathPart(target.streamKey);
    const attempts: SRSDvrApplyResult['attempts'] = [];

    for (const vhost of target.vhosts ?? DEFAULT_DVR_VHOSTS) {
      try {
        const result = await this.runRawCommand({
          scope: 'dvr',
          cmd: command,
          vhost,
          app,
          stream,
        });
        const ok = (result as { code?: number } | undefined)?.code === 0;
        attempts.push({ vhost, ok });
        if (ok) {
          return { ok: true, command, app, stream, vhost, attempts };
        }
      } catch (err) {
        attempts.push({
          vhost,
          ok: false,
          error: err instanceof Error ? err.message : 'SRS raw API request failed',
        });
      }
    }

    return { ok: false, command, app, stream, attempts };
  }

  startDvr(target: SRSDvrApplyTarget): Promise<SRSDvrApplyResult> {
    return this.applyDvrCommand('start', target);
  }

  stopDvr(target: SRSDvrApplyTarget): Promise<SRSDvrApplyResult> {
    return this.applyDvrCommand('stop', target);
  }

  /**
   * Validates SRS is reachable and records desired routing graph.
   * Runtime forwards are applied by SRS via the control-api `on_forward` hook at publish time.
   */
  async reconcileDesiredConfig(desired: SRSDesiredConfig): Promise<GatewayRuntimeApplyResult> {
    const version = await this.getVersion();
    const activeStreams = await this.listStreams();

    const ingestCount = desired.ingests.length;
    const forwardCount = desired.ingests.reduce((total, ingest) => total + ingest.forwards.length, 0);
    const transcodeCount = countTranscodeIngests(desired.ingests);
    const drift = summarizeRuntimeDrift(desired, activeStreams);
    const transcode = transcodeSummary(desired);

    const transcodeNote =
      transcodeCount > 0
        ? ` ${transcodeCount} transcode profile(s) mapped; static SRS transcode config/reload still required.`
        : '';
    const driftNote =
      drift.unmanagedActiveStreamCount > 0
        ? ` ${drift.unmanagedActiveStreamCount} active stream(s) are not in desired gateway state.`
        : '';

    return {
      synced: true,
      note:
        `SRS reachable; ${ingestCount} ingest route(s), ${forwardCount} forward target(s).` +
        transcodeNote +
        driftNote +
        ' Forwards resolve at publish via POST /api/webhooks/srs/forward.',
      appliedConfig: {
        mode: 'publish-time-forward-hooks',
        checkedAt: new Date().toISOString(),
        srsVersion: version,
        runtime: {
          reachable: true,
          activeStreamCount: activeStreams.length,
          drift,
          dvr: {
            mode: 'session-raw-api',
            supported: true,
            vhosts: DEFAULT_DVR_VHOSTS,
          },
          transcode,
        },
        desiredSummary: {
          ingestCount,
          forwardCount,
          transcodeCount,
        },
      },
    };
  }

  verifyWebhookAuth(headerSecret: string | undefined): boolean {
    if (!this.webhookSecret) {
      return true;
    }
    return headerSecret === this.webhookSecret;
  }
}
