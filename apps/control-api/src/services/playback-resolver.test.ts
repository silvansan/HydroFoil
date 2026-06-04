import { describe, expect, it } from 'vitest';

import {
  buildLegacyFlvPath,
  buildUpstreamMediaPath,
  findSrsStream,
  resolveStreamVhost,
} from './playback-resolver';

describe('playback-resolver', () => {
  it('builds canonical upstream paths with vhost query', () => {
    expect(buildUpstreamMediaPath('gtch', 'fr-gi2uep', '__defaultVhost__', 'm3u8')).toBe(
      '/gtch/fr-gi2uep.m3u8?vhost=__defaultVhost__'
    );
    expect(buildUpstreamMediaPath('gtch', 'fr-gi2uep', 'hydrofoil.silvans.ch', 'flv')).toBe(
      '/gtch/fr-gi2uep.flv?vhost=hydrofoil.silvans.ch'
    );
  });

  it('builds legacy flv path for old SRS remux mounts', () => {
    expect(buildLegacyFlvPath('gtch', 'fr-gi2uep', '__defaultVhost__')).toBe(
      '/__defaultVhost__/gtch/fr-gi2uep.flv?vhost=__defaultVhost__'
    );
  });

  it('resolves vhost from SRS stream row', () => {
    expect(
      resolveStreamVhost({
        name: 'fr-gi2uep',
        app: 'gtch',
        vhost: 'hydrofoil.silvans.ch',
        publish: { active: true, vhost: '__defaultVhost__' },
      })
    ).toBe('__defaultVhost__');
  });

  it('ignores SRS internal stream ids mistaken for vhost', () => {
    expect(
      resolveStreamVhost({
        name: 'fr-gi2uep',
        app: 'gtch',
        vhost: 'vid-1n8qrr9',
        publish: { active: true, vhost: '__defaultVhost__' },
      })
    ).toBe('__defaultVhost__');
  });

  it('finds stream by app and name', () => {
    const streams = [
      { name: 'a', app: 'live' },
      { name: 'fr-gi2uep', app: 'gtch' },
    ];
    expect(findSrsStream(streams, 'gtch', 'fr-gi2uep')?.name).toBe('fr-gi2uep');
  });
});
