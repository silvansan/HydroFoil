import { Router } from 'express';
import { z } from 'zod';
import type { DomainBlock, Output, VodRoute } from '@hydrofoil/shared-types';

import type { AppContext } from '../context';
import { BadRequestError, NotFoundError, ForbiddenError } from '../errors';
import { asyncHandler } from '../middleware/async-handler';
import { parsePagination } from '../lib/pagination';
import {
  assertDomainBlockAccess,
  canManageApplications,
  filterDomainBlocksForScope,
  getAccessScope,
} from '../lib/access-control';
import { formatZodError } from '../lib/zod-errors';
import {
  ensureUniquePolicySlug,
  isValidPolicySlug,
  resolvePolicySlug,
} from '../lib/policy-slug';

const playbackAccessPolicySchema = z.enum(['public', 'token-required', 'restricted']);

const domainBlockBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).max(48).optional(),
  allowedDomains: z.array(z.string()).default([]),
  branding: z
    .object({
      logoUrl: z.string().url().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
    })
    .optional(),
  playbackAccessPolicy: playbackAccessPolicySchema,
  tokenRequired: z.boolean().optional(),
});

const createDomainBlockSchema = domainBlockBodySchema.superRefine((data, ctx) => {
  if (data.playbackAccessPolicy === 'restricted' && data.allowedDomains.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one allowed domain for a domain allowlist policy',
      path: ['allowedDomains'],
    });
  }
});

const updateDomainBlockSchema = domainBlockBodySchema.partial().superRefine((data, ctx) => {
  if (
    data.playbackAccessPolicy === 'restricted' &&
    data.allowedDomains !== undefined &&
    data.allowedDomains.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add at least one allowed domain for a domain allowlist policy',
      path: ['allowedDomains'],
    });
  }
});

type PlaybackAccessPolicy = z.infer<typeof playbackAccessPolicySchema>;

function assertRestrictedHasDomains(
  policy: PlaybackAccessPolicy,
  allowedDomains: string[]
): void {
  if (policy === 'restricted' && allowedDomains.length === 0) {
    throw new BadRequestError(
      'Add at least one allowed domain for a domain allowlist policy'
    );
  }
}

function normalizeAllowedDomains(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

async function resolveUniqueSlugForCreate(
  ctx: AppContext,
  organizationId: string,
  name: string,
  slugInput?: string
): Promise<string> {
  const existing: DomainBlock[] = await ctx.repos.domainBlocks.listAll(organizationId);
  const taken = new Set<string>(existing.map((block) => block.slug));
  const base = resolvePolicySlug(name, slugInput);
  return ensureUniquePolicySlug(base, taken);
}

export function createDomainBlocksRouter(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const scope = getAccessScope(req);
      const result = await ctx.repos.domainBlocks.list(ctx.organizationId, parsePagination(req));
      const items = filterDomainBlocksForScope(result.items, scope);
      res.json({ ...result, items, total: items.length });
    })
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      assertDomainBlockAccess(getAccessScope(req), req.params.id);
      const block = await ctx.repos.domainBlocks.findById(ctx.organizationId, req.params.id);
      if (!block) throw new NotFoundError('Domain block not found');
      res.json(block);
    })
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      if (!canManageApplications(getAccessScope(req))) {
        throw new ForbiddenError('Only admins can create privacy policies');
      }
      const parsed = createDomainBlockSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const slug = await resolveUniqueSlugForCreate(
        ctx,
        ctx.organizationId,
        parsed.data.name,
        parsed.data.slug
      );
      const tokenRequired =
        parsed.data.tokenRequired ?? parsed.data.playbackAccessPolicy === 'token-required';
      res.status(201).json(
        await ctx.repos.domainBlocks.create(ctx.organizationId, {
          name: parsed.data.name.trim(),
          slug,
          allowedDomains: parsed.data.allowedDomains,
          branding: parsed.data.branding,
          playbackAccessPolicy: parsed.data.playbackAccessPolicy,
          tokenRequired,
        })
      );
    })
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      assertDomainBlockAccess(getAccessScope(req), req.params.id);
      const parsed = updateDomainBlockSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(formatZodError(parsed.error));
      const existing = await ctx.repos.domainBlocks.findById(ctx.organizationId, req.params.id);
      if (!existing) throw new NotFoundError('Domain block not found');

      const patch: Parameters<typeof ctx.repos.domainBlocks.update>[2] = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
      if (parsed.data.allowedDomains !== undefined) patch.allowedDomains = parsed.data.allowedDomains;
      if (parsed.data.branding !== undefined) patch.branding = parsed.data.branding ?? null;
      if (parsed.data.playbackAccessPolicy !== undefined) {
        patch.playbackAccessPolicy = parsed.data.playbackAccessPolicy;
      }
      if (parsed.data.tokenRequired !== undefined) {
        patch.tokenRequired = parsed.data.tokenRequired;
      } else if (parsed.data.playbackAccessPolicy !== undefined) {
        patch.tokenRequired = parsed.data.playbackAccessPolicy === 'token-required';
      }

      if (parsed.data.slug !== undefined) {
        const nameForSlug = parsed.data.name?.trim() ?? String(existing.name);
        const slug = resolvePolicySlug(nameForSlug, parsed.data.slug);
        if (!isValidPolicySlug(slug)) {
          throw new BadRequestError(
            'Internal ID must use lowercase letters, numbers, and hyphens (2–48 characters)'
          );
        }
        const slugTaken = await ctx.repos.domainBlocks.findBySlug(ctx.organizationId, slug);
        if (slugTaken && slugTaken.id !== req.params.id) {
          throw new BadRequestError(`Privacy policy ID "${slug}" is already in use`);
        }
        patch.slug = slug;
      }

      const existingBlock = existing as DomainBlock;
      const effectivePolicy = (patch.playbackAccessPolicy ??
        existingBlock.playbackAccessPolicy) as PlaybackAccessPolicy;
      const effectiveDomains =
        patch.allowedDomains ?? normalizeAllowedDomains(existingBlock.allowedDomains);
      assertRestrictedHasDomains(effectivePolicy, effectiveDomains);

      const updated = await ctx.repos.domainBlocks.update(
        ctx.organizationId,
        req.params.id,
        patch
      );
      if (!updated) throw new NotFoundError('Domain block not found');
      res.json(updated);
    })
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      assertDomainBlockAccess(getAccessScope(req), req.params.id);
      const outputs = await ctx.repos.outputs.listAll(ctx.organizationId);
      const vodRoutes = await ctx.repos.vodRoutes.listAll(ctx.organizationId);
      const linkedOutputs = (outputs as Output[]).filter(
        (output: Output) => output.domainBlockId === req.params.id
      );
      const linkedVodRoutes = (vodRoutes as VodRoute[]).filter(
        (route: VodRoute) => route.domainBlockId === req.params.id
      );
      await Promise.all(
        [
          ...linkedOutputs.map((output: Output) =>
            ctx.repos.outputs.update(ctx.organizationId, output.id, { domainBlockId: null })
          ),
          ...linkedVodRoutes.map((route: VodRoute) =>
            ctx.repos.vodRoutes.update(ctx.organizationId, String(route.id), { domainBlockId: null })
          ),
        ]
      );

      const deleted = await ctx.repos.domainBlocks.delete(ctx.organizationId, req.params.id);
      if (!deleted) throw new NotFoundError('Domain block not found');
      res.status(204).send();
    })
  );

  return router;
}
