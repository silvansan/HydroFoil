import { Router } from 'express';
import { z } from 'zod';

import type { Input, Output, Route } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { config } from '../config';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { afterRoutingMutation } from '../lib/routing-mutations';
import { formatZodError } from '../lib/zod-errors';
import {
  buildRestreamGroups,
  isWatchOutputName,
  toRestreamDestination,
  type RestreamDestinationDto,
} from '../lib/restream';
import { buildSrtPushUrl } from '@hydrofoil/domain';
import { assertInputAccess, filterInputsByScope, getAccessScope } from '../lib/access-control';

const rtmpUrl = z
  .string()
  .min(1)
  .refine((u) => /^rtmps?:\/\//i.test(u.trim()), 'Must be an rtmp:// or rtmps:// URL');

const srtUrl = z
  .string()
  .min(1)
  .refine((u) => /^srt:\/\//i.test(u.trim()), 'Must be an srt:// URL');

const pushUrl = z
  .string()
  .min(1)
  .refine(
    (u) => /^rtmps?:\/\//i.test(u.trim()) || /^srt:\/\//i.test(u.trim()),
    'Must be an rtmp:// or srt:// URL'
  );

const createRestreamSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rtmp_external'),
    name: z.string().min(1),
    pushUrl: rtmpUrl,
    enabled: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('srt_external'),
    name: z.string().min(1),
    pushUrl: srtUrl,
    srtStreamId: z.string().optional(),
    passphrase: z.string().optional(),
    latency: z.number().int().min(0).max(8000).optional(),
    enabled: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('rtmp_mirror'),
    name: z.string().min(1),
    gatewayAppName: z.string().min(1),
    gatewayStreamName: z.string().min(1),
    enabled: z.boolean().optional(),
  }),
]);

const patchRestreamSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  pushUrl: pushUrl.optional(),
});

async function assertRestreamOutputAccess(
  ctx: AppContext,
  outputId: string,
  scope: ReturnType<typeof getAccessScope>
) {
  const allRoutes = await ctx.repos.routes.listAll(ctx.organizationId);
  const route = allRoutes.find((r: Route) => r.outputIds.includes(outputId));
  if (!route) {
    throw new NotFoundError('Restream destination not found');
  }
  await assertInputAccess(ctx.organizationId, route.inputId, scope, ctx.repos);
}

function internalRtmpTarget(appName: string, streamName: string): string {
  const base = config.srsRtmpForwardBase.replace(/\/$/, '');
  const app = appName.replace(/^\/+|\/+$/g, '');
  const stream = streamName.replace(/^\/+|\/+$/g, '');
  return `${base}/${app}/${stream}`;
}

export function createRestreamsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const [inputsResult, routes, outputs] = await Promise.all([
        ctx.repos.inputs.list(ctx.organizationId, {
          page: 1,
          pageSize: 500,
          applicationIds: scope.applicationIds ?? undefined,
        }),
        ctx.repos.routes.listAll(ctx.organizationId),
        ctx.repos.outputs.listAll(ctx.organizationId),
      ]);
      const inputs = filterInputsByScope(inputsResult.items, scope) as Input[];
      res.json({ items: buildRestreamGroups(inputs, routes, outputs) });
    })
  );

  router.get(
    '/inputs/:inputId',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.inputId, getAccessScope(req), ctx.repos);
      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.inputId);
      if (!input) throw new NotFoundError('Input not found');

      const [routes, outputs] = await Promise.all([
        ctx.repos.routes.findByInputId(ctx.organizationId, input.id),
        ctx.repos.outputs.listAll(ctx.organizationId),
      ]);
      const outputById = new Map(outputs.map((o: Output) => [o.id, o]));
      const destinations = routes.flatMap((route: Route) =>
        route.outputIds
          .map((id: string) => outputById.get(id))
          .filter((o): o is Output => Boolean(o))
          .map((output: Output) => toRestreamDestination(output, input as Input, route.id))
      );

      destinations.sort((a: RestreamDestinationDto, b: RestreamDestinationDto) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      res.json({ input, destinations });
    })
  );

  router.post(
    '/inputs/:inputId',
    asyncHandler(async (req, res) => {
      await assertInputAccess(ctx.organizationId, req.params.inputId, getAccessScope(req), ctx.repos);
      const parsed = createRestreamSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));

      const input = await ctx.repos.inputs.findById(ctx.organizationId, req.params.inputId);
      if (!input) throw new NotFoundError('Input not found');

      const application = input.applicationId
        ? await ctx.repos.applications.findById(ctx.organizationId, input.applicationId)
        : null;
      const defaultApp = application?.appName ?? 'live';

      let output;
      if (parsed.data.type === 'rtmp_external') {
        output = await ctx.repos.outputs.create(ctx.organizationId, {
          name: parsed.data.name.trim(),
          routeTarget: parsed.data.pushUrl.trim(),
          playbackProtocol: 'rtmp',
          gatewayAppName: defaultApp,
          gatewayStreamName: input.streamKey,
          enabled: parsed.data.enabled ?? true,
          isPublic: false,
        });
      } else if (parsed.data.type === 'srt_external') {
        output = await ctx.repos.outputs.create(ctx.organizationId, {
          name: parsed.data.name.trim(),
          routeTarget: buildSrtPushUrl(parsed.data.pushUrl, {
            streamId: parsed.data.srtStreamId,
            passphrase: parsed.data.passphrase,
            latency: parsed.data.latency,
          }),
          playbackProtocol: 'rtmp',
          gatewayAppName: defaultApp,
          gatewayStreamName: input.streamKey,
          enabled: parsed.data.enabled ?? true,
          isPublic: false,
        });
      } else {
        const app = parsed.data.gatewayAppName.trim();
        const stream = parsed.data.gatewayStreamName.trim();
        output = await ctx.repos.outputs.create(ctx.organizationId, {
          name: parsed.data.name.trim(),
          routeTarget: internalRtmpTarget(app, stream),
          playbackProtocol: 'rtmp',
          gatewayAppName: app,
          gatewayStreamName: stream,
          enabled: parsed.data.enabled ?? true,
          isPublic: false,
        });
      }

      const route = await ctx.repos.routes.create(ctx.organizationId, {
        inputId: input.id,
        name: parsed.data.name.trim(),
        outputIds: [output.id],
        enabled: true,
      });

      await afterRoutingMutation(ctx.gateway, 'restream.created', output.id);
      res.status(201).json(toRestreamDestination(output as Output, input as Input, route.id));
    })
  );

  router.get(
    '/:destinationId',
    asyncHandler(async (req, res) => {
      await assertRestreamOutputAccess(ctx, req.params.destinationId, getAccessScope(req));
      const output = await ctx.repos.outputs.findById(
        ctx.organizationId,
        req.params.destinationId
      );
      if (!output) throw new NotFoundError('Restream destination not found');

      const allRoutes = await ctx.repos.routes.listAll(ctx.organizationId);
      const route = allRoutes.find((r: Route) => r.outputIds.includes(String(output.id)));
      const input = route
        ? await ctx.repos.inputs.findById(ctx.organizationId, route.inputId)
        : null;

      if (!input) {
        throw new NotFoundError('Source input for restream not found');
      }
      res.json({
        destination: toRestreamDestination(output as Output, input as Input, route?.id),
        input,
      });
    })
  );

  router.patch(
    '/:destinationId',
    asyncHandler(async (req, res) => {
      await assertRestreamOutputAccess(ctx, req.params.destinationId, getAccessScope(req));
      const parsed = patchRestreamSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));

      const output = await ctx.repos.outputs.findById(
        ctx.organizationId,
        req.params.destinationId
      );
      if (!output) throw new NotFoundError('Restream destination not found');
      if (isWatchOutputName(String(output.name))) {
        throw new BadRequestError('The built-in watch destination cannot be edited here');
      }

      const patch: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
      if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
      if (parsed.data.pushUrl !== undefined) patch.routeTarget = parsed.data.pushUrl.trim();

      const updated = await ctx.repos.outputs.update(ctx.organizationId, String(output.id), patch);
      if (!updated) throw new NotFoundError('Restream destination not found');

      const allRoutes = await ctx.repos.routes.listAll(ctx.organizationId);
      const route = allRoutes.find((r: Route) => r.outputIds.includes(String(updated.id)));
      const input = route
        ? await ctx.repos.inputs.findById(ctx.organizationId, route.inputId)
        : null;

      await afterRoutingMutation(ctx.gateway, 'restream.updated', String(updated.id));

      if (!input) {
        res.json(updated);
        return;
      }
      res.json(toRestreamDestination(updated as Output, input as Input, route?.id));
    })
  );

  router.delete(
    '/:destinationId',
    asyncHandler(async (req, res) => {
      await assertRestreamOutputAccess(ctx, req.params.destinationId, getAccessScope(req));
      const output = await ctx.repos.outputs.findById(
        ctx.organizationId,
        req.params.destinationId
      );
      if (!output) throw new NotFoundError('Restream destination not found');
      if (isWatchOutputName(String(output.name))) {
        throw new BadRequestError('The built-in watch destination cannot be deleted');
      }

      const outputId = String(output.id);
      const allRoutes = await ctx.repos.routes.listAll(ctx.organizationId);
      for (const route of allRoutes) {
        if (!route.outputIds.includes(outputId)) continue;
        const nextIds = route.outputIds.filter((id: string) => id !== outputId);
        if (nextIds.length === 0) {
          await ctx.repos.routes.delete(ctx.organizationId, route.id);
        } else {
          await ctx.repos.routes.update(ctx.organizationId, route.id, { outputIds: nextIds });
        }
      }

      await ctx.repos.outputs.delete(ctx.organizationId, outputId);
      await afterRoutingMutation(ctx.gateway, 'restream.deleted', outputId);
      res.status(204).send();
    })
  );

  return router;
}
