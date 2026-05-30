import type { Database, Repositories } from '@hydrofoil/db';
import type { EventBus } from '@hydrofoil/events';

import type { AudioOrchestrator } from './services/audio-orchestrator';
import type { GatewayOrchestrator } from './services/gateway-orchestrator';
import type { RecordingOrchestrator } from './services/recording-orchestrator';
import type { RestreamOrchestrator } from './services/restream-orchestrator';

export interface AppContext {
  db: Database;
  repos: Repositories;
  organizationId: string;
  eventBus: EventBus;
  gateway: GatewayOrchestrator;
  recordings: RecordingOrchestrator;
  restreams: RestreamOrchestrator;
  audio: AudioOrchestrator;
}
