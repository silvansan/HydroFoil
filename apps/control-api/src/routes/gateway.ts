import { Router } from 'express';
import { SRSGatewayConfigGenerator } from '@hydrofoil/domain';

import type { AppContext } from '../context';
import { asyncHandler } from '../middleware/async-handler';

export function createGatewayRouter(ctx: AppContext): Router {
  const router = Router();
  const configGenerator = new SRSGatewayConfigGenerator();

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      const [inputs, routes, outputs, domainBlocks, streamProfiles] = await Promise.all([
        ctx.repos.inputs.listAll(ctx.organizationId),
        ctx.repos.routes.listAll(ctx.organizationId),
        ctx.repos.outputs.listAll(ctx.organizationId),
        ctx.repos.domainBlocks.listAll(ctx.organizationId),
        ctx.repos.streamProfiles.listAll(ctx.organizationId),
      ]);

      const desiredConfig = configGenerator.generateDesiredConfig({
        inputs,
        routes,
        outputs,
        streamProfiles,
        domainBlocks,
      });

      const latest = await ctx.repos.gatewayConfig.getLatest(ctx.organizationId);
      const desiredVersion = latest ? Number(latest.desired_version) : 0;
      const appliedVersion = latest ? Number(latest.applied_version) : 0;
      const configHash = configGenerator.computeConfigHash(desiredConfig);
      const persistedHash = latest?.desired_config
        ? configGenerator.computeConfigHash(latest.desired_config as typeof desiredConfig)
        : null;

      res.json({
        engine: 'srs',
        desiredVersion,
        appliedVersion,
        synced: desiredVersion > 0 && appliedVersion >= desiredVersion && !latest?.error,
        pendingReconcile: persistedHash !== configHash,
        configHash,
        ingestCount: desiredConfig.ingests.length,
        error: latest?.error ?? null,
        lastSyncedAt: latest?.synced_at ?? null,
        desiredConfig,
      });
    })
  );

  return router;
}
