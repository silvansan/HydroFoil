import pino from 'pino';
import { createRepositories, Database, runMigrations } from '@hydrofoil/db';
import { EventBus } from '@hydrofoil/events';
import { QueueManager } from '@hydrofoil/queue';

import { createApp } from './app';
import { config } from './config';
import { GatewayOrchestrator } from './services/gateway-orchestrator';
import { RecordingOrchestrator } from './services/recording-orchestrator';
import { RestreamOrchestrator } from './services/restream-orchestrator';
import { AudioOrchestrator } from './services/audio-orchestrator';

const logger = pino();

async function bootstrap() {
  const db = new Database({ connectionString: config.databaseUrl });
  await db.connect();
  logger.info('Connected to Postgres');

  if (config.runMigrationsOnStart) {
    const applied = await runMigrations(db);
    if (applied.length > 0) {
      logger.info({ applied }, 'Applied database migrations');
    }
  }

  const repos = createRepositories(db);
  const organization = await repos.organizations.findBySlug(config.defaultOrganizationSlug);
  if (!organization) {
    throw new Error(
      `Organization "${config.defaultOrganizationSlug}" not found. Run migrations (003_seed_default_organization).`
    );
  }

  const eventBus = new EventBus();
  const queueManager = new QueueManager(config.redisUrl);
  const gateway = new GatewayOrchestrator(organization.id, eventBus, queueManager);
  const recordings = new RecordingOrchestrator(queueManager);
  const restreams = new RestreamOrchestrator(queueManager);
  const audio = new AudioOrchestrator(queueManager);

  const app = createApp({
    db,
    repos,
    organizationId: organization.id,
    eventBus,
    gateway,
    recordings,
    restreams,
    audio,
  });

  app.listen(config.port, () => {
    logger.info(
      { port: config.port, organizationId: organization.id, slug: organization.slug },
      'Control API listening'
    );
  });
}

bootstrap().catch((error) => {
  logger.error(error, 'Failed to start control-api');
  process.exit(1);
});
