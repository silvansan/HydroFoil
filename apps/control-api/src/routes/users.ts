import { Router } from 'express';
import { z } from 'zod';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { formatZodError } from '../lib/zod-errors';
import { parsePagination } from '../lib/pagination';
import { hashPassword } from '../lib/auth';
import {
  assertRoleAssignable,
  assertUserMutable,
  requireRoles,
} from '../middleware/require-role';
import { HttpError } from '../errors';

const roleSchema = z.enum(['super-admin', 'admin', 'manager']);

const updateUserAccessSchema = z.object({
  applicationIds: z.array(z.string().uuid()),
  recordingPolicyIds: z.array(z.string().uuid()).optional(),
  vodRouteIds: z.array(z.string().uuid()).optional(),
  domainBlockIds: z.array(z.string().uuid()).optional(),
  storageLocationIds: z.array(z.string().uuid()).optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  password: z.string().min(8).optional(),
  role: roleSchema.optional().default('manager'),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
});

export function createUsersRouter(ctx: AppContext): Router {
  const router = Router();

  router.use(requireRoles('super-admin', 'admin'));

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const result = await ctx.repos.users.list(ctx.organizationId, parsePagination(req));
      res.json(result);
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const user = await ctx.repos.users.findById(ctx.organizationId, req.params.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      res.json(user);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const actor = req.authUser!;
      assertRoleAssignable(actor.role, parsed.data.role);

      const existing = await ctx.repos.users.findByEmail(ctx.organizationId, parsed.data.email);
      if (existing) {
        throw new BadRequestError(`User with email "${parsed.data.email}" already exists`);
      }

      if (!parsed.data.password) {
        throw new BadRequestError('A temporary password is required when inviting a user');
      }

      const passwordHash = parsed.data.password
        ? await hashPassword(parsed.data.password)
        : undefined;

      const user = await ctx.repos.users.create(ctx.organizationId, {
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        role: parsed.data.role,
        isActive: parsed.data.isActive,
      });
      res.status(201).json(user);
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const actor = req.authUser!;
      const existingUser = await ctx.repos.users.findById(ctx.organizationId, req.params.id);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      assertUserMutable(actor.role, existingUser.role);
      if (parsed.data.role) {
        assertRoleAssignable(actor.role, parsed.data.role);
      }

      if (parsed.data.email) {
        const taken = await ctx.repos.users.findByEmail(ctx.organizationId, parsed.data.email);
        if (taken && taken.id !== req.params.id) {
          throw new BadRequestError(`User with email "${parsed.data.email}" already exists`);
        }
      }

      const updateData: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.password) {
        updateData.passwordHash = await hashPassword(parsed.data.password);
        delete updateData.password;
      }

      const user = await ctx.repos.users.update(ctx.organizationId, req.params.id, updateData as any);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json(user);
    })
  );

  router.get(
    '/:id/access',
    asyncHandler(async (req, res) => {
      const user = await ctx.repos.users.findById(ctx.organizationId, req.params.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const [applicationIds, recordingPolicyIds, vodRouteIds, domainBlockIds, storageLocationIds] =
        await Promise.all([
          ctx.repos.userAccess.listApplicationIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listRecordingPolicyIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listVodRouteIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listDomainBlockIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listStorageLocationIds(ctx.organizationId, user.id),
        ]);

      res.json({
        applicationIds,
        recordingPolicyIds,
        vodRouteIds,
        domainBlockIds,
        storageLocationIds,
      });
    })
  );

  router.patch(
    '/:id/access',
    asyncHandler(async (req, res) => {
      const parsed = updateUserAccessSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const user = await ctx.repos.users.findById(ctx.organizationId, req.params.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.role !== 'manager') {
        throw new BadRequestError('Access scopes apply to moderators only');
      }

      try {
        await ctx.repos.userAccess.setApplicationIds(
          ctx.organizationId,
          user.id,
          parsed.data.applicationIds
        );
        if (parsed.data.recordingPolicyIds !== undefined) {
          await ctx.repos.userAccess.setRecordingPolicyIds(
            ctx.organizationId,
            user.id,
            parsed.data.recordingPolicyIds
          );
        }
        if (parsed.data.vodRouteIds !== undefined) {
          await ctx.repos.userAccess.setVodRouteIds(
            ctx.organizationId,
            user.id,
            parsed.data.vodRouteIds
          );
        }
        if (parsed.data.domainBlockIds !== undefined) {
          await ctx.repos.userAccess.setDomainBlockIds(
            ctx.organizationId,
            user.id,
            parsed.data.domainBlockIds
          );
        }
        if (parsed.data.storageLocationIds !== undefined) {
          await ctx.repos.userAccess.setStorageLocationIds(
            ctx.organizationId,
            user.id,
            parsed.data.storageLocationIds
          );
        }
      } catch (error) {
        throw new BadRequestError(
          error instanceof Error ? error.message : 'Invalid access assignment'
        );
      }

      const [applicationIds, recordingPolicyIds, vodRouteIds, domainBlockIds, storageLocationIds] =
        await Promise.all([
          ctx.repos.userAccess.listApplicationIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listRecordingPolicyIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listVodRouteIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listDomainBlockIds(ctx.organizationId, user.id),
          ctx.repos.userAccess.listStorageLocationIds(ctx.organizationId, user.id),
        ]);

      res.json({
        allApplications: false,
        applicationIds,
        allRecordingPolicies: recordingPolicyIds.length === 0,
        recordingPolicyIds,
        allVodRoutes: vodRouteIds.length === 0,
        vodRouteIds,
        allDomainBlocks: domainBlockIds.length === 0,
        domainBlockIds,
        allStorageLocations: storageLocationIds.length === 0,
        storageLocationIds,
      });
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const actor = req.authUser!;
      const user = await ctx.repos.users.findById(ctx.organizationId, req.params.id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.id === actor.userId) {
        throw new HttpError(400, 'You cannot delete your own account');
      }

      assertUserMutable(actor.role, user.role);
      await ctx.repos.users.delete(ctx.organizationId, req.params.id);
      res.status(204).send();
    })
  );

  return router;
}
