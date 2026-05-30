import { SRSGatewayConfigGenerator, type SRSDesiredConfig } from '@hydrofoil/domain';

import type { Repositories } from './repositories';

export interface ReconcileGatewayResult {
  skipped: boolean;
  desiredVersion?: number;
  configHash?: string;
  synced: boolean;
  note?: string;
}

export interface GatewayRuntimeApplyResult {
  synced: boolean;
  note: string;
  appliedConfig?: unknown;
}

export class GatewayReconciliationService {
  private readonly configGenerator = new SRSGatewayConfigGenerator();

  constructor(private readonly repos: Repositories) {}

  async buildDesiredConfig(organizationId: string): Promise<SRSDesiredConfig> {
    const [inputs, routes, outputs, domainBlocks, streamProfiles] = await Promise.all([
      this.repos.inputs.listAll(organizationId),
      this.repos.routes.listAll(organizationId),
      this.repos.outputs.listAll(organizationId),
      this.repos.domainBlocks.listAll(organizationId),
      this.repos.streamProfiles.listAll(organizationId),
    ]);

    return this.configGenerator.generateDesiredConfig({
      inputs,
      routes,
      outputs,
      streamProfiles,
      domainBlocks,
    });
  }

  async reconcile(
    organizationId: string,
    applyToRuntime: (config: SRSDesiredConfig) => Promise<GatewayRuntimeApplyResult>
  ): Promise<ReconcileGatewayResult> {
    const desiredConfig = await this.buildDesiredConfig(organizationId);
    const configHash = this.configGenerator.computeConfigHash(desiredConfig);
    const latest = await this.repos.gatewayConfig.getLatest(organizationId);

    if (latest) {
      const latestHash = this.configGenerator.computeConfigHash(
        latest.desired_config as SRSDesiredConfig
      );
      const appliedVersion = Number(latest.applied_version);
      const desiredVersion = Number(latest.desired_version);

      if (latestHash === configHash && appliedVersion >= desiredVersion) {
        return { skipped: true, synced: true, configHash, desiredVersion };
      }

      if (latestHash === configHash && appliedVersion < desiredVersion) {
        const runtimeResult = await applyToRuntime(desiredConfig);
        if (runtimeResult.synced) {
          await this.repos.gatewayConfig.markSynced(
            latest.id,
            runtimeResult.appliedConfig ?? desiredConfig
          );
          return { skipped: false, desiredVersion, configHash, synced: true, note: runtimeResult.note };
        }
        await this.repos.gatewayConfig.markError(latest.id, runtimeResult.note);
        return { skipped: false, desiredVersion, configHash, synced: false, note: runtimeResult.note };
      }
    }

    const previousApplied = latest ? Number(latest.applied_version) : 0;
    const nextDesiredVersion = latest ? Number(latest.desired_version) + 1 : 1;

    const versionRow = await this.repos.gatewayConfig.insertDesired({
      organizationId,
      desiredVersion: nextDesiredVersion,
      appliedVersion: previousApplied,
      desiredConfig,
      configHash,
    });

    const runtimeResult = await applyToRuntime(desiredConfig);

    if (runtimeResult.synced) {
      await this.repos.gatewayConfig.markSynced(
        versionRow.id,
        runtimeResult.appliedConfig ?? desiredConfig
      );
      return {
        skipped: false,
        desiredVersion: nextDesiredVersion,
        configHash,
        synced: true,
        note: runtimeResult.note,
      };
    }

    await this.repos.gatewayConfig.markError(versionRow.id, runtimeResult.note);
    return {
      skipped: false,
      desiredVersion: nextDesiredVersion,
      configHash,
      synced: false,
      note: runtimeResult.note,
    };
  }
}
