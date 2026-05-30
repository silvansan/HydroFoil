import { describe, expect, it } from 'vitest';

import {
  buildForwardRtmpUrl,
  buildForwardRtmpUrls,
  filterForwardsForPublish,
  findIngestByAppAndStreamKey,
  findIngestByStreamKey,
} from './srs-forward';
import type { SRSDesiredConfig } from './services';

describe('srs-forward', () => {
  const config: SRSDesiredConfig = {
    version: 1,
    generatedAt: new Date().toISOString(),
    defaultVhost: '__defaultVhost__',
    ingests: [
      {
        routeId: 'r1',
        routeName: 'Main',
        inputId: 'i1',
        inputName: 'Main',
        streamKey: 'stage-key',
        enabled: true,
        vhost: '__defaultVhost__',
        app: 'live',
        forwards: [
          {
            id: 'o1',
            name: 'HLS out',
            protocol: 'hls',
            vhost: '__defaultVhost__',
            app: 'live',
            stream: 'main-hls',
            routeTarget: '/live/main-hls.m3u8',
            isPublic: true,
          },
        ],
      },
    ],
  };

  it('skips forwards that match the published ingest path', () => {
    const forwards = config.ingests[0]!.forwards;
    expect(filterForwardsForPublish(forwards, { app: 'live', stream: 'main-hls' })).toHaveLength(0);
    expect(filterForwardsForPublish(forwards, { app: 'live', stream: 'stage-key' })).toHaveLength(1);
    expect(
      buildForwardRtmpUrls(forwards, 'rtmp://127.0.0.1:1935', { app: 'live', stream: 'main-hls' })
    ).toEqual([]);
    expect(
      buildForwardRtmpUrls(forwards, 'rtmp://127.0.0.1:1935', { app: 'live', stream: 'stage-key' })
    ).toEqual(['rtmp://127.0.0.1:1935/live/main-hls']);
  });

  it('uses external route_target as forward URL', () => {
    const external = [
      {
        id: 'o2',
        name: 'YouTube',
        protocol: 'rtmp' as const,
        vhost: '__defaultVhost__',
        app: 'live',
        stream: 'unused',
        routeTarget: 'rtmp://a.rtmp.youtube.com/live2/key-abc',
        isPublic: false,
      },
    ];
    expect(
      buildForwardRtmpUrls(external, 'rtmp://127.0.0.1:1935', { app: 'live', stream: 'stage-key' })
    ).toEqual(['rtmp://a.rtmp.youtube.com/live2/key-abc']);
  });

  it('skips SRT worker-push destinations from SRS forward hook', () => {
    const srtExternal = [
      {
        id: 'o3',
        name: 'vMix',
        protocol: 'rtmp' as const,
        vhost: '__defaultVhost__',
        app: 'live',
        stream: 'unused',
        routeTarget: 'srt://192.168.1.50:10080?streamid=#!::r=live/key,m=publish',
        isPublic: false,
      },
    ];
    expect(
      buildForwardRtmpUrls(srtExternal, 'rtmp://127.0.0.1:1935', { app: 'live', stream: 'stage-key' })
    ).toEqual([]);
  });

  it('builds RTMP forward URLs', () => {
    expect(buildForwardRtmpUrl({ app: 'live', stream: 'main-hls' }, 'rtmp://127.0.0.1:1935')).toBe(
      'rtmp://127.0.0.1:1935/live/main-hls'
    );
    expect(buildForwardRtmpUrls(config.ingests[0]!.forwards, 'rtmp://127.0.0.1:1935')).toEqual([
      'rtmp://127.0.0.1:1935/live/main-hls',
    ]);
  });

  it('finds ingest by stream key', () => {
    expect(findIngestByStreamKey(config, 'stage-key')?.routeName).toBe('Main');
    expect(findIngestByStreamKey(config, 'missing')).toBeUndefined();
    expect(findIngestByAppAndStreamKey(config, 'live', 'stage-key')?.routeName).toBe('Main');
    expect(findIngestByAppAndStreamKey(config, 'other', 'stage-key')).toBeUndefined();
  });
});
