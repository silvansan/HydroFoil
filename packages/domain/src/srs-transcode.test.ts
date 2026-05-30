import { describe, expect, it } from 'vitest';

import { buildTranscodeGatewayMapping, countTranscodeIngests } from './srs-transcode';
import type { StreamProfile } from '@hydrofoil/shared-types';

const baseProfile: StreamProfile = {
  id: '10000000-0000-4000-8000-000000000100',
  organizationId: '00000000-0000-4000-8000-000000000001',
  name: '720p ladder',
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('buildTranscodeGatewayMapping', () => {
  it('builds SRS engine entries from renditions', () => {
    const mapping = buildTranscodeGatewayMapping(baseProfile);
    const srsTranscode = mapping.srsTranscode as { engines: Array<{ name: string; vbitrate: number }> };

    expect(srsTranscode.enabled).toBe(true);
    expect(srsTranscode.engines).toHaveLength(1);
    expect(srsTranscode.engines[0]?.name).toBe('720p');
    expect(srsTranscode.engines[0]?.vbitrate).toBe(2500);
  });

  it('returns empty mapping for passthrough profiles', () => {
    expect(
      buildTranscodeGatewayMapping({
        ...baseProfile,
        mode: 'passthrough',
        renditions: [],
      })
    ).toEqual({});
  });
});

describe('countTranscodeIngests', () => {
  it('counts ingests with transcode profiles', () => {
    expect(
      countTranscodeIngests([
        { profile: { mode: 'transcode', renditions: [{}] } },
        { profile: { mode: 'passthrough', renditions: [] } },
        {},
      ])
    ).toBe(1);
  });
});
