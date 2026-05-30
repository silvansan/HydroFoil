import { GatewayReconciliationService } from '@hydrofoil/db';
import type { ReconcileGatewayConfigJob } from '@hydrofoil/queue';
import { SRSAdapter } from '@hydrofoil/srs-adapter';
import type { Repositories } from '@hydrofoil/db';
import type { Job } from 'bull';
import pino from 'pino';

const logger = pino();

export async function processReconcileGatewayConfig(
  job: Job<ReconcileGatewayConfigJob>,
  repos: Repositories
): Promise<{ success: boolean; data?: unknown }> {
  const { organizationId, reason } = job.data;
  logger.info({ jobId: job.id, organizationId, reason }, 'Reconciling gateway config');

  const srsApiUrl = process.env.SRS_HTTP_API_URL || 'http://localhost:1985';
  const srsAdapter = new SRSAdapter(srsApiUrl, process.env.SRS_WEBHOOK_SECRET ?? '');
  const reconciliation = new GatewayReconciliationService(repos);

  const result = await reconciliation.reconcile(organizationId, (config) =>
    srsAdapter.reconcileDesiredConfig(config)
  );

  logger.info({ organizationId, result }, 'Gateway reconciliation finished');
  return { success: true, data: result };
}
