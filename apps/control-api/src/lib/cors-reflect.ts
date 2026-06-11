import type { NextFunction, Request, Response } from 'express';

/** Opaque/sandboxed iframe origins send the literal string "null". */
export function isOpaqueNullOrigin(origin: string | undefined): boolean {
  return origin === 'null';
}

/**
 * Reflect Access-Control-Allow-Origin for embed manifest requests.
 * Sandboxed iframes require ACAO: null (not * and not a missing header).
 */
export function reflectEmbedManifestCors(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  if (isOpaqueNullOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  } else if (typeof origin === 'string' && origin.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

function isEmbedManifestPath(req: Request): boolean {
  const path = req.path || req.url.split('?')[0] || '';
  return path === '/api/playback/embed-manifest' || path.startsWith('/api/playback/embed-manifest/');
}

/** Re-apply embed CORS headers on error responses (global cors may not have run). */
export function applyEmbedManifestCorsHeaders(req: Request, res: Response): void {
  if (res.headersSent) return;
  if (!isEmbedManifestPath(req)) return;

  const origin = req.headers.origin;
  if (isOpaqueNullOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  } else if (typeof origin === 'string' && origin.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.vary('Origin');
  }
}
