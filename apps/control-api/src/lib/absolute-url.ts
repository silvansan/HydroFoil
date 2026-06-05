import type { Request } from 'express';

import { config } from '../config';

export function appendTokenToPath(path: string, token?: string): string {
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}`;
}

/** Operator-facing absolute URL — prefers PUBLIC_APP_URL so embeds stay HTTPS behind TLS proxies. */
export function absoluteUrl(req: Request, urlPath: string): string {
  if (/^https?:\/\//i.test(urlPath)) return urlPath;

  const normalizedPath = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const publicBase = config.publicAppUrl?.replace(/\/$/, '');
  if (publicBase) {
    return `${publicBase}${normalizedPath}`;
  }

  const forwardedProto = headerValue(req.headers['x-forwarded-proto']);
  const proto = forwardedProto?.split(',')[0]?.trim() || req.protocol || 'http';
  const host =
    headerValue(req.headers['x-forwarded-host'])?.split(',')[0]?.trim() ||
    req.get('host') ||
    'localhost';
  return `${proto}://${host}${normalizedPath}`;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
