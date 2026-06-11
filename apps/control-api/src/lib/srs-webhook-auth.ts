import type { Request, Response } from 'express';

import { config } from '../config';

/** Base paths for SRS http_hooks (secret appended at deploy time via query param). */
export const SRS_WEBHOOK_PUBLISH_PATH = '/api/webhooks/srs';
export const SRS_WEBHOOK_FORWARD_PATH = '/api/webhooks/srs/forward';

/** Append ?secret= when SRS cannot send custom headers (SRS http_hooks POST JSON only). */
export function appendSrsWebhookSecret(url: string, secret?: string): string {
  if (!secret) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('secret', secret);
  return parsed.toString();
}

export function buildSrsWebhookPublishUrl(baseUrl: string, secret?: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return appendSrsWebhookSecret(`${trimmed}${SRS_WEBHOOK_PUBLISH_PATH}`, secret);
}

export function buildSrsWebhookForwardUrl(baseUrl: string, secret?: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return appendSrsWebhookSecret(`${trimmed}${SRS_WEBHOOK_FORWARD_PATH}`, secret);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** SRS http_hooks send JSON only — secret may arrive via header, query, or body. */
export function extractSrsWebhookSecret(req: Pick<Request, 'header' | 'query' | 'body'>): string | undefined {
  const fromHeader =
    readString(req.header('x-srs-secret')) ?? readString(req.header('x-webhook-secret'));
  if (fromHeader) return fromHeader;

  const query = req.query as Record<string, unknown>;
  const fromQuery =
    readString(query.secret) ?? readString(query.webhook_secret);
  if (fromQuery) return fromQuery;

  const body = req.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object') {
    return readString(body.secret) ?? readString(body.webhook_secret);
  }

  return undefined;
}

export function verifySrsWebhookSecret(req: Pick<Request, 'header' | 'query' | 'body'>, res: Response): boolean {
  const expected = config.srsWebhookSecret;
  if (!expected) {
    res.status(401).json({ code: 401, error: 'Invalid webhook secret' });
    return false;
  }

  const provided = extractSrsWebhookSecret(req);
  if (provided !== expected) {
    res.status(401).json({ code: 401, error: 'Invalid webhook secret' });
    return false;
  }

  return true;
}
