import {
  DomainEventType,
  EventBus,
  gatewayReconciliationRequired,
  type DomainEvent,
} from '@hydrofoil/events';
import {
  enqueueGatewayReconciliation,
  JobType,
  QueueManager,
  type ReconcileGatewayConfigJob,
} from '@hydrofoil/queue';
import type { Queue } from '@hydrofoil/queue';
import pino from 'pino';

const logger = pino();

export class GatewayOrchestrator {
  private readonly reconcileQueue: Queue<ReconcileGatewayConfigJob>;

  constructor(
    private readonly organizationId: string,
    private readonly eventBus: EventBus,
    queueManager: QueueManager
  ) {
    this.reconcileQueue = queueManager.createQueue(JobType.RECONCILE_GATEWAY_CONFIG);
    this.eventBus.subscribe(DomainEventType.GATEWAY_RECONCILIATION_REQUIRED, async (event: DomainEvent) => {
      logger.info({ eventType: event.eventType, aggregateId: event.aggregateId }, 'Domain event handled');
    });
  }

  async requestReconciliation(reason: string, triggerAggregateId?: string): Promise<void> {
    const event = gatewayReconciliationRequired(this.organizationId, reason, {
      triggerAggregateId,
    });

    await this.eventBus.publish(event);
    logger.info({ reason, triggerAggregateId }, 'gateway.reconciliation.required');

    await enqueueGatewayReconciliation(this.reconcileQueue, {
      organizationId: this.organizationId,
      reason,
      triggerAggregateId,
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.eventBus.publish(event);
  }
}
