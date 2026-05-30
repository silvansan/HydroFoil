import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { isValidAppName, slugifyAppName } from '../lib/slug';
import { formatZodError } from '../lib/zod-errors';
import { parsePagination } from '../lib/pagination';

const appNameSchema = z
  .string()
  .min(1)
  .max(63)
  .refine((value) => isValidAppName(value), {
    message: 'Use lowercase letters, numbers, and hyphens only',
  });

const createApplicationSchema = z.object({
  name: z.string().min(1),
  appName: z.string().max(63).optional(),
  description: z.string().optional(),
});

function resolveAppName(name: string, appNameInput?: string): string {
  const trimmed = appNameInput?.trim();
  let appName = trimmed && trimmed.length > 0 ? trimmed : slugifyAppName(name);
  if (!isValidAppName(appName)) {
    appName = slugifyAppName(name);
  }
  return appName;
}

const updateApplicationSchema = z.object({
  name: z.string().min(1).optional(),
  appName: appNameSchema.optional(),
  description: z.string().nullable().optional(),
});

export function createApplicationsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const result = await ctx.repos.applications.list(ctx.organizationId, parsePagination(req));
      res.json(result);
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const application = await ctx.repos.applications.findById(ctx.organizationId, req.params.id);
      if (!application) {
        throw new NotFoundError('Application not found');
      }
      res.json(application);
    })
  );

  router.get(
    '/:id/inputs',
    asyncHandler(async (req, res) => {
      const application = await ctx.repos.applications.findById(ctx.organizationId, req.params.id);
      if (!application) {
        throw new NotFoundError('Application not found');
      }
      const inputs = await ctx.repos.inputs.listAll(ctx.organizationId, application.id);
      res.json({ items: inputs, application });
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      const appName = resolveAppName(parsed.data.name, parsed.data.appName);
      const existing = await ctx.repos.applications.findByAppName(ctx.organizationId, appName);
      if (existing) {
        throw new BadRequestError(`Application slug "${appName}" already exists`);
      }
      const application = await ctx.repos.applications.create(ctx.organizationId, {
        name: parsed.data.name,
        appName,
        description: parsed.data.description,
      });
      res.status(201).json(application);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }
      if (parsed.data.appName) {
        const taken = await ctx.repos.applications.findByAppName(
          ctx.organizationId,
          parsed.data.appName
        );
        if (taken && taken.id !== req.params.id) {
          throw new BadRequestError(`Application slug "${parsed.data.appName}" already exists`);
        }
      }
      const application = await ctx.repos.applications.update(
        ctx.organizationId,
        req.params.id,
        parsed.data
      );
      if (!application) {
        throw new NotFoundError('Application not found');
      }
      res.json(application);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const application = await ctx.repos.applications.findById(
        ctx.organizationId,
        req.params.id
      );
      if (!application) {
        throw new NotFoundError('Application not found');
      }
      const inputCount = application.inputCount ?? 0;
      if (inputCount > 0) {
        throw new BadRequestError(
          `Remove all ${inputCount} stream key(s) from this application before deleting it.`
        );
      }
      await ctx.repos.applications.delete(ctx.organizationId, req.params.id);
      res.status(204).send();
    })
  );

  return router;
}
