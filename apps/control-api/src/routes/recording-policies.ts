import { Router } from 'express';

import { z } from 'zod';



import type { AppContext } from '../context';

import { BadRequestError, NotFoundError } from '../errors';

import { asyncHandler } from '../middleware/async-handler';

import { parsePagination } from '../lib/pagination';
import {
  assertRecordingPolicyDefinitionAccess,
  assertStorageLocationAccess,
  canCreateRecordingPolicyDefinitions,
  canManageApplications,
  filterByIdList,
  filterRecordingPoliciesForDefinitions,
  getAccessScope,
} from '../lib/access-control';

function filterByIdListForAttach<T extends { id: string }>(
  items: T[],
  scope: ReturnType<typeof getAccessScope>
) {
  return filterByIdList(items, scope.recordingPolicyIds);
}
import { ForbiddenError } from '../errors';



const createPolicySchema = z.object({

  name: z.string().min(1),

  enabled: z.boolean().optional(),

  storageLocationId: z.string().uuid(),

  pathPrefix: z.string().min(1),

  filenameTemplate: z.string().min(1),

  retentionDays: z.number().int().positive().optional(),
  remuxToMp4: z.boolean().optional(),
  keepSourceFlvHours: z.number().int().positive().nullable().optional(),

});



const updatePolicySchema = createPolicySchema.partial();



export function createRecordingPoliciesRouter(ctx: AppContext): Router {

  const router = Router();



  router.get(

    '/',

    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const purpose = req.query.purpose === 'attach' ? 'attach' : 'manage';
      const result = await ctx.repos.recordingPolicies.list(ctx.organizationId, parsePagination(req));
      const items =
        purpose === 'attach'
          ? filterByIdListForAttach(result.items, scope)
          : filterRecordingPoliciesForDefinitions(result.items, scope);
      res.json({ ...result, items, total: items.length });
    })

  );



  router.get(

    '/:id',

    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      assertRecordingPolicyDefinitionAccess(scope, req.params.id);
      const policy = await ctx.repos.recordingPolicies.findById(ctx.organizationId, req.params.id);
      if (!policy) throw new NotFoundError('Recording policy not found');
      res.json(policy);
    })

  );



  router.post(

    '/',

    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      if (!canCreateRecordingPolicyDefinitions(scope)) {
        throw new ForbiddenError('You do not have permission to create recording policies');
      }

      const parsed = createPolicySchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      assertStorageLocationAccess(scope, parsed.data.storageLocationId);
      const location = await ctx.repos.storageLocations.findById(
        ctx.organizationId,
        parsed.data.storageLocationId
      );
      if (!location) throw new BadRequestError('Storage location not found');

      const policy = await ctx.repos.recordingPolicies.create(ctx.organizationId, parsed.data);
      if (!canManageApplications(scope) && req.authUser) {
        await ctx.repos.userAccess.addRecordingPolicyAssignment(
          ctx.organizationId,
          req.authUser.userId,
          String(policy.id)
        );
      }

      res.status(201).json(policy);
    })

  );



  router.patch(

    '/:id',

    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      assertRecordingPolicyDefinitionAccess(scope, req.params.id);

      const parsed = updatePolicySchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.message);

      if (parsed.data.storageLocationId) {
        assertStorageLocationAccess(scope, parsed.data.storageLocationId);
        const location = await ctx.repos.storageLocations.findById(
          ctx.organizationId,
          parsed.data.storageLocationId
        );
        if (!location) throw new BadRequestError('Storage location not found');
      }



      const updated = await ctx.repos.recordingPolicies.update(

        ctx.organizationId,

        req.params.id,

        parsed.data

      );

      if (!updated) throw new NotFoundError('Recording policy not found');

      res.json(updated);

    })

  );



  router.delete(

    '/:id',

    asyncHandler(async (req, res) => {
      assertRecordingPolicyDefinitionAccess(getAccessScope(req), req.params.id);
      const deleted = await ctx.repos.recordingPolicies.delete(ctx.organizationId, req.params.id);

      if (!deleted) throw new NotFoundError('Recording policy not found');

      res.status(204).send();

    })

  );



  return router;

}


