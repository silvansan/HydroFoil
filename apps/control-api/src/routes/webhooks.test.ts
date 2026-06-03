import http from 'node:http';

import bodyParser from 'body-parser';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../context';
import { config } from '../config';
import { createWebhooksRouter } from './webhooks';

const organizationId = '00000000-0000-4000-8000-000000000001';
const input = {
  id: 'input-1',
  organizationId,
  name: 'Main',
  streamKey: 'main-key',
  audioFeedProfileId: undefined,
};
const session = {
  id: 'session-1',
  inputId: input.id,
  organizationId,
  gatewayApp: 'live',
  streamKey: input.streamKey,
  status: 'publishing',
  startedAt: new Date(Date.now() - 10_000),
};

function createMockContext(overrides: Partial<AppContext> = {}) {
  return {
    organizationId,
    repos: {
      liveSessions: {
        findActiveByAppAndStreamKey: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(session),
        endSession: vi.fn().mockResolvedValue({ ...session, status: 'idle', endedAt: new Date() }),
      },
      recordingAssets: {
        findActiveBySessionId: vi.fn().mockResolvedValue(null),
                  listActiveBySessionId: vi.fn().mockResolvedValue([]),
      },
      routes: { listAll: vi.fn().mockResolvedValue([]) },
      outputs: { listAll: vi.fn().mockResolvedValue([]) },
      domainBlocks: { listAll: vi.fn().mockResolvedValue([]) },
      streamProfiles: { listAll: vi.fn().mockResolvedValue([]) },
      inputs: {
        findByAppAndStreamKey: vi.fn().mockResolvedValue(input),
        listAll: vi.fn().mockResolvedValue([]),
      },
    },
    gateway: { publish: vi.fn() },
    restreams: {
      startSrtPushes: vi.fn(),
      stopSrtPushes: vi.fn(),
    },
    recordings: {
      scheduleFinalize: vi.fn(),
    },
    audio: {
      scheduleForSession: vi.fn(),
    },
    ...overrides,
  } as unknown as AppContext;
}

async function withWebhookServer<T>(ctx: AppContext, run: (baseUrl: string) => Promise<T>) {
  const app = express();
  app.use(bodyParser.json());
  app.use('/api/webhooks', createWebhooksRouter(ctx));
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a port');

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function postWebhook(baseUrl: string, body: unknown, headers?: Record<string, string>) {
  const response = await fetch(`${baseUrl}/api/webhooks/srs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
  };
}

describe('SRS webhook route', () => {
  const originalSecret = config.srsWebhookSecret;

  beforeEach(() => {
    config.srsWebhookSecret = '';
  });

  afterEach(() => {
    config.srsWebhookSecret = originalSecret;
  });

  it('creates a LiveSession and emits stream.started on publish', async () => {
    const ctx = createMockContext();

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(baseUrl, {
        action: 'on_publish',
        app: 'live',
        stream: 'main-key',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ code: 0, data: { sessionId: session.id } });
      expect(ctx.repos.liveSessions.create).toHaveBeenCalledWith({
        inputId: input.id,
        organizationId,
        gatewayApp: 'live',
        streamKey: 'main-key',
        status: 'publishing',
      });
      expect(ctx.gateway.publish).toHaveBeenCalledTimes(1);
      expect(ctx.restreams.startSrtPushes).toHaveBeenCalledTimes(1);
    });
  });

  it('allows unknown publish stream keys without creating a session', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.repos.inputs.findByAppAndStreamKey).mockResolvedValueOnce(null);

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(baseUrl, {
        action: 'on_publish',
        app: 'live',
        stream: 'unknown-key',
      });

      expect(result.status).toBe(200);
      expect(result.body.data.note).toContain('No input registered');
      expect(ctx.repos.liveSessions.create).not.toHaveBeenCalled();
    });
  });

  it('does not duplicate active sessions for repeated publish hooks', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.repos.liveSessions.findActiveByAppAndStreamKey).mockResolvedValueOnce(
      session as any
    );

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(baseUrl, {
        action: 'on_publish',
        app: 'live',
        stream: 'main-key',
      });

      expect(result.body).toMatchObject({
        code: 0,
        data: { sessionId: session.id, duplicate: true },
      });
      expect(ctx.repos.liveSessions.create).not.toHaveBeenCalled();
    });
  });

  it('schedules DVR audio extraction on unpublish when no recording finalize will run', async () => {
    const ctx = createMockContext();
    vi.mocked(ctx.repos.liveSessions.findActiveByAppAndStreamKey).mockResolvedValueOnce(
      session as any
    );
    vi.mocked(ctx.repos.recordingAssets.listActiveBySessionId).mockResolvedValueOnce([]);

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(baseUrl, {
        action: 'on_unpublish',
        app: 'live',
        stream: 'main-key',
      });

      expect(result.status).toBe(200);
      expect(ctx.audio.scheduleForSession).toHaveBeenCalledTimes(1);
      expect(ctx.audio.scheduleForSession).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'live' })
      );
    });
  });

  it('ends active sessions and schedules finalize work on unpublish', async () => {
    const activeRecording = {
      id: 'recording-1',
      organizationId,
      liveSessionId: session.id,
      objectKey: 'dvr/live/main.flv',
      startedAt: session.startedAt,
    };
    const ctx = createMockContext();
    vi.mocked(ctx.repos.liveSessions.findActiveByAppAndStreamKey).mockResolvedValueOnce(
      session as any
    );
    vi.mocked(ctx.repos.recordingAssets.findActiveBySessionId).mockResolvedValueOnce(
      activeRecording as any
    );
              vi.mocked(ctx.repos.recordingAssets.listActiveBySessionId).mockResolvedValueOnce([
                activeRecording as any,
              ]);

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(baseUrl, {
        action: 'on_unpublish',
        app: 'live',
        stream: 'main-key',
      });

      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ code: 0, data: { sessionId: session.id } });
      expect(ctx.audio.scheduleForSession).not.toHaveBeenCalled();
      expect(ctx.recordings.scheduleFinalize).toHaveBeenCalledTimes(1);
      expect(ctx.repos.liveSessions.endSession).toHaveBeenCalledWith(session.id);
      expect(ctx.gateway.publish).toHaveBeenCalledTimes(1);
      expect(ctx.restreams.stopSrtPushes).toHaveBeenCalledWith(session.id);
    });
  });

  it('rejects webhook calls with an invalid SRS secret', async () => {
    config.srsWebhookSecret = 'expected-secret';
    const ctx = createMockContext();

    await withWebhookServer(ctx, async (baseUrl) => {
      const result = await postWebhook(
        baseUrl,
        { action: 'on_publish', app: 'live', stream: 'main-key' },
        { 'x-srs-secret': 'wrong-secret' }
      );

      expect(result.status).toBe(401);
      expect(result.body.error).toBe('Invalid webhook secret');
      expect(ctx.repos.inputs.findByAppAndStreamKey).not.toHaveBeenCalled();
    });
  });
});
