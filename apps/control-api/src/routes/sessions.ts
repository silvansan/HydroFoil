import { Router } from 'express';

import type { Output, Route } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';
import {
  deleteRecordingFromStorage,
} from '../services/recording-playback';
import { publisherStatsForSession, fetchSrsPublisherStatsByIngest } from '../services/srs-publisher-stats';
import { syncLiveSessionsFromSrs } from '../services/live-session-sync';

export function createLiveSessionsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      await syncLiveSessionsFromSrs(ctx);
      const pagination = parsePagination(req);
      const statusParam = req.query.status;
      const status =
        typeof statusParam === 'string' && statusParam.length > 0 ? statusParam : undefined;
      const activeOnly =
        req.query.activeOnly === 'true' ||
        req.query.activeOnly === '1' ||
        status === 'publishing';

      if (activeOnly) {
        const [items, statsByIngest] = await Promise.all([
          ctx.repos.liveSessions.listPublishing(ctx.organizationId),
          fetchSrsPublisherStatsByIngest(),
        ]);
        const enriched = items.map((session: { gatewayApp?: string; streamKey: string }) => ({
          ...session,
          publisher: publisherStatsForSession(
            statsByIngest,
            session.gatewayApp,
            session.streamKey
          ),
        }));
        res.json({
          items: enriched,
          total: enriched.length,
          page: 1,
          pageSize: enriched.length,
          hasMore: false,
        });
        return;
      }

      res.json(
        await ctx.repos.liveSessions.list(ctx.organizationId, pagination, {
          status,
        })
      );
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      await syncLiveSessionsFromSrs(ctx);
      const session = await ctx.repos.liveSessions.findById(ctx.organizationId, req.params.id);
      if (!session) {
        throw new NotFoundError('Live session not found');
      }

      const [input, routes, outputs] = await Promise.all([
        ctx.repos.inputs.findById(ctx.organizationId, String(session.inputId)),
        ctx.repos.routes.listAll(ctx.organizationId),
        ctx.repos.outputs.listAll(ctx.organizationId),
      ]);

      if (!input) {
        throw new NotFoundError('Input for session not found');
      }

      const linkedRoutes = routes.filter((route: Route) => route.inputId === input.id);
      const outputIds = new Set(linkedRoutes.flatMap((route: Route) => route.outputIds));
      const linkedOutputs = outputs.filter((output: Output) => outputIds.has(output.id));

      res.json({ session, input, routes: linkedRoutes, outputs: linkedOutputs });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const session = await ctx.repos.liveSessions.findById(ctx.organizationId, req.params.id);
      if (!session) {
        throw new NotFoundError('Live session not found');
      }
      if (session.status === 'publishing') {
        throw new BadRequestError(
          'Cannot delete a session that is still publishing. Stop the encoder first.'
        );
      }
      const deleted = await ctx.repos.liveSessions.delete(ctx.organizationId, req.params.id);
      if (!deleted) {
        throw new NotFoundError('Live session not found');
      }
      res.status(204).send();
    })
  );

  return router;
}

export function createRecordingsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      res.json(await ctx.repos.recordingAssets.list(ctx.organizationId, parsePagination(req)));
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);
      if (!asset) {
        throw new NotFoundError('Recording not found');
      }
      res.json(asset);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const asset = await ctx.repos.recordingAssets.findById(ctx.organizationId, req.params.id);
      if (!asset) throw new NotFoundError('Recording not found');

      if (asset.status === 'ready' || asset.status === 'failed') {
        await deleteRecordingFromStorage(
          {
            storageLocation: String(asset.storageLocation),
            objectKey: String(asset.objectKey),
            metadata:
              asset.metadata && typeof asset.metadata === 'object'
                ? (asset.metadata as Record<string, unknown>)
                : undefined,
          },
          ctx.repos
        );
      }

      const deleted = await ctx.repos.recordingAssets.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Recording not found');
      res.status(204).send();
    })
  );

  return router;
}
