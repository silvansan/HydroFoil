import { spawn, type ChildProcess } from 'node:child_process';

import type { StartRestreamPushJob, StopRestreamPushJob } from '@hydrofoil/queue';
import type { Job } from 'bull';
import pino from 'pino';

const logger = pino({ name: 'restream-push' });

const activePushes = new Map<string, ChildProcess>();

function pushKey(sessionId: string, destinationId: string): string {
  return `${sessionId}:${destinationId}`;
}

function spawnSrtPush(
  sessionId: string,
  destinationId: string,
  sourceUrl: string,
  pushUrl: string,
  name: string
): ChildProcess {
  const key = pushKey(sessionId, destinationId);
  const existing = activePushes.get(key);
  if (existing && !existing.killed) {
    logger.info({ sessionId, destinationId, name }, 'SRT push already running');
    return existing;
  }

  const args = [
    '-nostats',
    '-loglevel',
    'warning',
    '-re',
    '-i',
    sourceUrl,
    '-c',
    'copy',
    '-pes_payload_size',
    '0',
    '-f',
    'mpegts',
    pushUrl,
  ];

  logger.info({ sessionId, destinationId, name, sourceUrl, pushUrl }, 'Starting FFmpeg SRT push');
  const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) logger.debug({ sessionId, destinationId, line }, 'ffmpeg stderr');
  });

  child.on('exit', (code, signal) => {
    activePushes.delete(key);
    logger.info({ sessionId, destinationId, name, code, signal }, 'FFmpeg SRT push exited');
  });

  child.on('error', (err) => {
    activePushes.delete(key);
    logger.error({ sessionId, destinationId, name, err: err.message }, 'FFmpeg SRT push failed to start');
  });

  activePushes.set(key, child);
  return child;
}

export async function processStartRestreamPush(
  job: Job<StartRestreamPushJob>
): Promise<{ success: boolean; started: number }> {
  const { sessionId, sourceUrl, destinations } = job.data;
  let started = 0;

  for (const dest of destinations) {
    spawnSrtPush(sessionId, dest.destinationId, sourceUrl, dest.pushUrl, dest.name);
    started += 1;
  }

  return { success: true, started };
}

export async function processStopRestreamPush(
  job: Job<StopRestreamPushJob>
): Promise<{ success: boolean; stopped: number }> {
  const { sessionId } = job.data;
  let stopped = 0;
  const prefix = `${sessionId}:`;

  for (const [key, child] of activePushes.entries()) {
    if (!key.startsWith(prefix)) continue;
    if (!child.killed) {
      child.kill('SIGTERM');
      stopped += 1;
    }
    activePushes.delete(key);
  }

  logger.info({ sessionId, stopped }, 'Stopped SRT restream pushes');
  return { success: true, stopped };
}

export function stopAllRestreamPushes(): void {
  for (const [key, child] of activePushes.entries()) {
    if (!child.killed) child.kill('SIGTERM');
    activePushes.delete(key);
  }
}
