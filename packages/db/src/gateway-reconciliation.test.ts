import { describe, expect, it, vi } from 'vitest';

import type { SRSDesiredConfig } from '@hydrofoil/domain';
import { SRSGatewayConfigGenerator } from '@hydrofoil/domain';

import { GatewayReconciliationService } from './gateway-reconciliation';
import type { Repositories } from './repositories';

const ORG = 'org-11111111-1111-1111-1111-111111111111';
const generator = new SRSGatewayConfigGenerator();

function emptyDesired(): SRSDesiredConfig {
  return generator.generateDesiredConfig({
    inputs: [],
    routes: [],
    outputs: [],
    streamProfiles: [],
    domainBlocks: [],
  });
}

function mockRepos(overrides: {
  gateway?: Partial<Repositories['gatewayConfig']>;
  inputs?: Repositories['inputs']['listAll'];
  routes?: Repositories['routes']['listAll'];
  outputs?: Repositories['outputs']['listAll'];
  domainBlocks?: Repositories['domainBlocks']['listAll'];
  streamProfiles?: Repositories['streamProfiles']['listAll'];
}): Repositories {
  return {
    inputs: { listAll: overrides.inputs ?? vi.fn(async () => []) },
    routes: { listAll: overrides.routes ?? vi.fn(async () => []) },
    outputs: { listAll: overrides.outputs ?? vi.fn(async () => []) },
    domainBlocks: { listAll: overrides.domainBlocks ?? vi.fn(async () => []) },
    streamProfiles: { listAll: overrides.streamProfiles ?? vi.fn(async () => []) },
    gatewayConfig: {
      getLatest: vi.fn(async () => null),
      insertDesired: vi.fn(async (params) => ({
        id: 'version-new',
        organization_id: params.organizationId,
        desired_version: params.desiredVersion,
        applied_version: params.appliedVersion,
        desired_config: params.desiredConfig,
      })),
      markSynced: vi.fn(async () => undefined),
      markError: vi.fn(async () => undefined),
      ...overrides.gateway,
    },
  } as unknown as Repositories;
}

describe('GatewayReconciliationService', () => {
  it('creates first desired version and marks synced when runtime apply succeeds', async () => {
    const apply = vi.fn(async () => ({
      synced: true,
      note: 'ok',
      appliedConfig: { mode: 'runtime-snapshot' },
    }));
    const markSynced = vi.fn(async () => undefined);
    const repos = mockRepos({
      gateway: { markSynced },
    });
    const service = new GatewayReconciliationService(repos);

    const result = await service.reconcile(ORG, apply);

    expect(result.synced).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.desiredVersion).toBe(1);
    expect(apply).toHaveBeenCalledOnce();
    expect(repos.gatewayConfig.insertDesired).toHaveBeenCalledOnce();
    expect(markSynced).toHaveBeenCalledWith('version-new', { mode: 'runtime-snapshot' });
  });

  it('skips when persisted hash matches and applied version is current', async () => {
    const desired = emptyDesired();
    const configHash = generator.computeConfigHash(desired);
    const apply = vi.fn(async () => ({ synced: true, note: 'ok' }));
    const repos = mockRepos({
      gateway: {
        getLatest: vi.fn(async () => ({
          id: 'version-1',
          desired_version: 2,
          applied_version: 2,
          desired_config: desired,
        })),
      },
    });
    const service = new GatewayReconciliationService(repos);

    const result = await service.reconcile(ORG, apply);

    expect(result.skipped).toBe(true);
    expect(result.synced).toBe(true);
    expect(result.configHash).toBe(configHash);
    expect(apply).not.toHaveBeenCalled();
    expect(repos.gatewayConfig.insertDesired).not.toHaveBeenCalled();
  });

  it('retries runtime apply when hash unchanged but applied lags desired', async () => {
    const desired = emptyDesired();
    const apply = vi.fn(async () => ({
      synced: true,
      note: 'retry ok',
      appliedConfig: { mode: 'runtime-snapshot', version: 3 },
    }));
    const markSynced = vi.fn(async () => undefined);
    const repos = mockRepos({
      gateway: {
        getLatest: vi.fn(async () => ({
          id: 'version-1',
          desired_version: 3,
          applied_version: 2,
          desired_config: desired,
        })),
        markSynced,
      },
    });
    const service = new GatewayReconciliationService(repos);

    const result = await service.reconcile(ORG, apply);

    expect(result.skipped).toBe(false);
    expect(result.synced).toBe(true);
    expect(result.desiredVersion).toBe(3);
    expect(apply).toHaveBeenCalledOnce();
    expect(repos.gatewayConfig.insertDesired).not.toHaveBeenCalled();
    expect(markSynced).toHaveBeenCalledWith('version-1', {
      mode: 'runtime-snapshot',
      version: 3,
    });
  });

  it('inserts new version when desired config hash changes', async () => {
    const previous = emptyDesired();
    const apply = vi.fn(async () => ({ synced: true, note: 'v2' }));
    const inputId = 'input-11111111-1111-1111-1111-111111111111';
    const outputId = 'output-11111111-1111-1111-1111-111111111111';
    const routeId = 'route-11111111-1111-1111-1111-111111111111';
    const repos = mockRepos({
      gateway: {
        getLatest: vi.fn(async () => ({
          id: 'version-1',
          desired_version: 1,
          applied_version: 1,
          desired_config: previous,
        })),
      },
      inputs: vi.fn(async () => [
        {
          id: inputId,
          organizationId: ORG,
          applicationId: 'app-1',
          name: 'Main',
          streamKey: 'main-key',
          ingestProtocol: 'rtmp',
          enabled: true,
          application: { id: 'app-1', name: 'Live', appName: 'live' },
        },
      ] as never),
      routes: vi.fn(async () => [
        {
          id: routeId,
          organizationId: ORG,
          inputId,
          name: 'Main route',
          enabled: true,
          outputIds: [outputId],
        },
      ] as never),
      outputs: vi.fn(async () => [
        {
          id: outputId,
          organizationId: ORG,
          name: 'Watch: main-key',
          routeTarget: '/live/main-key.m3u8',
          playbackProtocol: 'hls',
          gatewayAppName: 'live',
          gatewayStreamName: 'main-key',
          enabled: true,
          isPublic: true,
        },
      ] as never),
    });
    const service = new GatewayReconciliationService(repos);

    const result = await service.reconcile(ORG, apply);

    expect(result.desiredVersion).toBe(2);
    expect(result.synced).toBe(true);
    expect(repos.gatewayConfig.insertDesired).toHaveBeenCalledOnce();
  });

  it('records error when runtime apply fails', async () => {
    const apply = vi.fn(async () => ({ synced: false, note: 'SRS unreachable' }));
    const markError = vi.fn(async () => undefined);
    const repos = mockRepos({
      gateway: { markError },
    });
    const service = new GatewayReconciliationService(repos);

    const result = await service.reconcile(ORG, apply);

    expect(result.synced).toBe(false);
    expect(result.note).toBe('SRS unreachable');
    expect(markError).toHaveBeenCalledWith('version-new', 'SRS unreachable');
  });
});
