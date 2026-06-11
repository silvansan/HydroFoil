import { describe, expect, it } from 'vitest';

import {
  appendSrsWebhookSecret,
  buildSrsWebhookForwardUrl,
  buildSrsWebhookPublishUrl,
  extractSrsWebhookSecret,
} from './srs-webhook-auth';

describe('srs-webhook-auth', () => {
  it('appends secret query param to hook URLs', () => {
    expect(
      appendSrsWebhookSecret('http://control-api:3001/api/webhooks/srs', 'abc123')
    ).toBe('http://control-api:3001/api/webhooks/srs?secret=abc123');
    expect(buildSrsWebhookPublishUrl('http://control-api:3001', 'abc123')).toBe(
      'http://control-api:3001/api/webhooks/srs?secret=abc123'
    );
    expect(buildSrsWebhookForwardUrl('http://control-api:3001', 'abc123')).toBe(
      'http://control-api:3001/api/webhooks/srs/forward?secret=abc123'
    );
  });

  it('leaves hook URLs unchanged when secret is empty', () => {
    expect(appendSrsWebhookSecret('http://control-api:3001/api/webhooks/srs')).toBe(
      'http://control-api:3001/api/webhooks/srs'
    );
  });

  it('extracts webhook secret from header, query, or body', () => {
    expect(
      extractSrsWebhookSecret({
        header: (name) => (name === 'x-srs-secret' ? 'header-secret' : undefined),
        query: {},
        body: {},
      })
    ).toBe('header-secret');

    expect(
      extractSrsWebhookSecret({
        header: () => undefined,
        query: { secret: 'query-secret' },
        body: {},
      })
    ).toBe('query-secret');

    expect(
      extractSrsWebhookSecret({
        header: () => undefined,
        query: { webhook_secret: 'alt-query-secret' },
        body: {},
      })
    ).toBe('alt-query-secret');

    expect(
      extractSrsWebhookSecret({
        header: () => undefined,
        query: {},
        body: { secret: 'body-secret' },
      })
    ).toBe('body-secret');
  });

  it('prefers header secret over query and body', () => {
    expect(
      extractSrsWebhookSecret({
        header: (name) => (name === 'x-webhook-secret' ? 'header-wins' : undefined),
        query: { secret: 'query-secret' },
        body: { secret: 'body-secret' },
      })
    ).toBe('header-wins');
  });
});
