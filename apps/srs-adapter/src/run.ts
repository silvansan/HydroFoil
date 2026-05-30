import pino from 'pino';
import { SRSAdapter } from './adapter';

const logger = pino();
const adapter = new SRSAdapter(
  process.env.SRS_HTTP_API_URL || 'http://localhost:1985',
  process.env.SRS_WEBHOOK_SECRET ?? ''
);

adapter
  .getVersion()
  .then((version) => logger.info({ version }, 'SRS adapter ready'))
  .catch((error) => logger.warn({ error }, 'SRS adapter could not reach SRS HTTP API'));
