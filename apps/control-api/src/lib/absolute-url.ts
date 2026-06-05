import type { Request } from 'express';

export function appendTokenToPath(path: string, token?: string): string {
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}token=${encodeURIComponent(token)}`;
}

export function absoluteUrl(req: Request, urlPath: string): string {
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  const proto =
    (typeof req.headers['x-forwarded-proto'] === 'string' && req.headers['x-forwarded-proto']) ||
    req.protocol;
  const host =
    (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
    req.get('host') ||
    'localhost';
  return `${proto}://${host}${urlPath.startsWith('/') ? urlPath : `/${urlPath}`}`;
}
