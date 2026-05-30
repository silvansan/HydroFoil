import type { GatewayOrchestrator } from '../services/gateway-orchestrator';

export async function afterRoutingMutation(
  gateway: GatewayOrchestrator,
  reason: string,
  aggregateId?: string
): Promise<void> {
  await gateway.requestReconciliation(reason, aggregateId);
}
