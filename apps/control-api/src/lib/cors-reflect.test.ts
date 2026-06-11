import http from 'node:http';

import express from 'express';
import { describe, expect, it } from 'vitest';

import { applyEmbedManifestCorsHeaders, reflectEmbedManifestCors } from './cors-reflect';

async function withServer(
  setup: (app: express.Express) => void,
  run: (baseUrl: string) => Promise<void>
) {
  const app = express();
  setup(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('reflectEmbedManifestCors', () => {
  it('reflects Origin null for sandboxed iframe requests', async () => {
    await withServer(
      (app) => {
        app.use('/api/playback/embed-manifest', reflectEmbedManifestCors);
        app.get('/api/playback/embed-manifest', (_req, res) => {
          res.json({ ok: true });
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/playback/embed-manifest`, {
          headers: { Origin: 'null' },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('access-control-allow-origin')).toBe('null');
        expect(response.headers.get('access-control-allow-credentials')).toBe('true');
      }
    );
  });

  it('answers OPTIONS preflight for Origin null', async () => {
    await withServer(
      (app) => {
        app.use('/api/playback/embed-manifest', reflectEmbedManifestCors);
        app.get('/api/playback/embed-manifest', (_req, res) => {
          res.json({ ok: true });
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/playback/embed-manifest`, {
          method: 'OPTIONS',
          headers: { Origin: 'null', 'Access-Control-Request-Method': 'GET' },
        });
        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('null');
      }
    );
  });

  it('includes CORS headers when the handler returns 500', async () => {
    await withServer(
      (app) => {
        app.use('/api/playback/embed-manifest', reflectEmbedManifestCors);
        app.get('/api/playback/embed-manifest', (_req, _res, next) => {
          next(new Error('boom'));
        });
        app.use(
          (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
            applyEmbedManifestCorsHeaders(req, res);
            res.status(500).json({ error: err instanceof Error ? err.message : 'error' });
          }
        );
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/playback/embed-manifest`, {
          headers: { Origin: 'null' },
        });
        expect(response.status).toBe(500);
        expect(response.headers.get('access-control-allow-origin')).toBe('null');
      }
    );
  });
});
