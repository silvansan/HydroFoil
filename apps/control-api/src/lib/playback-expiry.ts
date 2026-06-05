import type { Request } from 'express';

import { config } from '../config';
import { BadRequestError } from '../errors';

const MIN_SECONDS = 5 * 60;
const MAX_SECONDS = 90 * 24 * 60 * 60;

export function resolvePlaybackExpirySeconds(req: Request): number {
  const expiresAtRaw = String(req.query.expiresAt ?? '').trim();
  const expiresInRaw = String(req.query.expiresInSeconds ?? '').trim();

  if (expiresAtRaw) {
    const expiresAtMs = Date.parse(expiresAtRaw);
    if (Number.isNaN(expiresAtMs)) {
      throw new BadRequestError('expiresAt must be a valid ISO date-time');
    }
    const seconds = Math.floor((expiresAtMs - Date.now()) / 1000);
    return clampExpirySeconds(seconds);
  }

  if (expiresInRaw) {
    const parsed = Number(expiresInRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestError('expiresInSeconds must be a positive number');
    }
    return clampExpirySeconds(Math.floor(parsed));
  }

  return clampExpirySeconds(config.playbackTokenTtlSeconds);
}

function clampExpirySeconds(seconds: number): number {
  if (seconds < MIN_SECONDS) {
    throw new BadRequestError(
      `Expiry must be at least ${MIN_SECONDS / 60} minutes in the future`
    );
  }
  if (seconds > MAX_SECONDS) {
    throw new BadRequestError(`Expiry cannot be more than ${MAX_SECONDS / 86400} days ahead`);
  }
  return seconds;
}
