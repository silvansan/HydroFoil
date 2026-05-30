import pino from 'pino';
import { SRSAdapter } from '@hydrofoil/srs-adapter';

import { config } from '../config';

const logger = pino({ name: 'srs-dvr' });

const VHOSTS = ['localhost', '__defaultVhost__'];

export interface SrsDvrTarget {
  gatewayApp: string;
  streamKey: string;
}

function createSrsAdapter() {
  return new SRSAdapter(config.srsHttpApiUrl, config.srsWebhookSecret);
}

/** Start SRS session DVR for an active publish (manual trigger). */
export async function startSrsDvr(target: SrsDvrTarget): Promise<{ ok: boolean; vhost?: string }> {
  const result = await createSrsAdapter().startDvr({ ...target, vhosts: VHOSTS });
  if (result.ok) {
    logger.info({ vhost: result.vhost, app: result.app, stream: result.stream }, 'SRS DVR started');
    return { ok: true, vhost: result.vhost };
  }

  logger.warn(
    { app: result.app, stream: result.stream, attempts: result.attempts },
    'SRS DVR start failed on all vhosts'
  );
  return { ok: false };
}

/** Stop SRS session DVR (optional manual stop before unpublish). */
export async function stopSrsDvr(target: SrsDvrTarget): Promise<boolean> {
  const result = await createSrsAdapter().stopDvr({ ...target, vhosts: VHOSTS });
  if (result.ok) {
    logger.info({ vhost: result.vhost, app: result.app, stream: result.stream }, 'SRS DVR stopped');
    return true;
  }
  logger.warn(
    { app: result.app, stream: result.stream, attempts: result.attempts },
    'SRS DVR stop failed on all vhosts'
  );
  return false;
}
