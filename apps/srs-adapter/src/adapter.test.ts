import axios from 'axios';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import type { SRSDesiredConfig } from '@hydrofoil/domain';

import { SRSAdapter, summarizeRuntimeDrift, type SRSStreamSummary } from './adapter';

vi.mock('axios');

const mockedPost = axios.post as unknown as Mock;
const mockedGet = axios.get as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

const desired: SRSDesiredConfig = {
  version: 1,
  generatedAt: '2026-05-30T10:00:00.000Z',
  defaultVhost: '__defaultVhost__',
  ingests: [
    {
      routeId: 'route-1',
      routeName: 'Main',
      inputId: 'input-1',
      inputName: 'Main',
      streamKey: 'main-key',
      enabled: true,
      vhost: '__defaultVhost__',
      app: 'live',
      forwards: [],
    },
    {
      routeId: 'route-2',
      routeName: 'Backup',
      inputId: 'input-2',
      inputName: 'Backup',
      streamKey: 'backup-key',
      enabled: true,
      vhost: '__defaultVhost__',
      app: 'live',
      forwards: [],
    },
  ],
};

const activeStreams: SRSStreamSummary[] = [
  {
    id: 'srs-stream-1',
    name: 'main-key',
    vhost: '__defaultVhost__',
    app: 'live',
    live_ms: 1500,
    clients: 2,
  },
  {
    id: 'srs-stream-2',
    name: 'unmanaged-key',
    vhost: '__defaultVhost__',
    app: 'live',
    live_ms: 500,
    clients: 0,
  },
];

describe('summarizeRuntimeDrift', () => {
  it('matches active SRS streams to desired ingests by app and stream key', () => {
    const summary = summarizeRuntimeDrift(desired, activeStreams);

    expect(summary.activeDesiredIngestCount).toBe(1);
    expect(summary.inactiveDesiredIngestCount).toBe(1);
    expect(summary.unmanagedActiveStreamCount).toBe(1);
    expect(summary.desiredIngests).toEqual([
      {
        routeId: 'route-1',
        inputId: 'input-1',
        app: 'live',
        streamKey: 'main-key',
        active: true,
      },
      {
        routeId: 'route-2',
        inputId: 'input-2',
        app: 'live',
        streamKey: 'backup-key',
        active: false,
      },
    ]);
    expect(summary.activeStreams).toContainEqual({
      id: 'srs-stream-2',
      app: 'live',
      streamKey: 'unmanaged-key',
      managed: false,
      clients: 0,
      liveMs: 500,
    });
  });
});

describe('SRSAdapter DVR raw API boundary', () => {
  it('starts DVR through SRS raw API and falls through vhosts until one succeeds', async () => {
    mockedPost
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({ data: { code: 0 } });

    const adapter = new SRSAdapter('http://srs:1985');
    const result = await adapter.startDvr({
      gatewayApp: '/live/',
      streamKey: '/main-key/',
      vhosts: ['localhost', '__defaultVhost__'],
    });

    expect(result.ok).toBe(true);
    expect(result.vhost).toBe('__defaultVhost__');
    expect(result.app).toBe('live');
    expect(result.stream).toBe('main-key');
    expect(mockedPost).toHaveBeenLastCalledWith('http://srs:1985/api/v1/raw', null, {
      params: {
        scope: 'dvr',
        cmd: 'start',
        vhost: '__defaultVhost__',
        app: 'live',
        stream: 'main-key',
      },
      timeout: 5000,
    });
  });
});

describe('SRSAdapter desired config apply summary', () => {
  it('reports transcode mappings as requiring static SRS config apply', async () => {
    mockedGet
      .mockResolvedValueOnce({ data: { version: '5' } })
      .mockResolvedValueOnce({ data: { streams: [] } });

    const result = await new SRSAdapter('http://srs:1985').reconcileDesiredConfig({
      ...desired,
      ingests: [
        {
          ...desired.ingests[0]!,
          profile: {
            id: 'profile-1',
            name: 'Transcode',
            mode: 'transcode',
            audioHandling: 'aac',
            renditions: [
              {
                name: '720p',
                videoBitrate: 2500,
                videoCodec: 'h264',
                resolution: '1280x720',
                fps: 30,
              },
            ],
            gatewayMapping: {
              srsTranscode: {
                enabled: true,
                engines: [{ name: '720p' }],
              },
            },
          },
        },
      ],
    });

    const applied = result.appliedConfig as {
      runtime: { transcode: { supported: boolean; applyMode: string; ingestCount: number } };
    };

    expect(result.synced).toBe(true);
    expect(applied.runtime.transcode.supported).toBe(false);
    expect(applied.runtime.transcode.applyMode).toBe('static-config-required');
    expect(applied.runtime.transcode.ingestCount).toBe(1);
  });
});
