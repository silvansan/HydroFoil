import { describe, expect, it } from 'vitest';

import { PlaybackTokenService } from './playback-token';

describe('PlaybackTokenService', () => {
  const service = new PlaybackTokenService('test-secret');

  it('round-trips tokens with generation in the payload', () => {
    const token = service.issueToken({
      organizationId: 'org-1',
      app: 'live',
      stream: 'main',
      exp: Math.floor(Date.now() / 1000) + 3600,
      gen: 2,
    });

    const payload = service.verifyToken(token);
    expect(payload).toMatchObject({
      organizationId: 'org-1',
      app: 'live',
      stream: 'main',
      gen: 2,
    });
  });

  it('accepts legacy tokens without generation', () => {
    const token = service.issueToken({
      organizationId: 'org-1',
      app: 'live',
      stream: 'main',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const payload = service.verifyToken(token);
    expect(payload?.gen).toBeUndefined();
  });
});
