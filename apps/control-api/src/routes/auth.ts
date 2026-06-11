import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../middleware/async-handler';
import { BadRequestError, UnauthorizedError } from '../errors';
import { formatZodError } from '../lib/zod-errors';
import { hashPassword, signAuthToken, verifyAuthToken, verifyPassword } from '../lib/auth';
import { isSmtpConfigured, sendMail } from '../lib/mail';
import { config } from '../config';
import type { AppContext } from '../context';
import { loadAccessScope } from '../lib/access-control';
import { serializeAccess } from '../lib/access-response';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const updateProfileSchema = z
  .object({
    email: z.string().email().optional(),
    displayName: z.string().nullable().optional(),
    currentPassword: z.string().min(8).optional(),
    password: z.string().min(8).optional(),
  })
  .refine((data) => !data.password || data.currentPassword, {
    message: 'Current password is required to set a new password',
    path: ['currentPassword'],
  });

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const requestAccessSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(120).optional(),
  message: z.string().max(2000).optional(),
});

function readBearerToken(authorization: string | undefined) {
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again later.',
    timestamp: new Date().toISOString(),
  },
});

export function createAuthRouter(ctx: AppContext) {
  const router = Router();

  router.post(
    '/login',
    loginRateLimit,
    asyncHandler(async (req, res) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const record = await ctx.repos.users.findByEmailWithPasswordHash(ctx.organizationId, parsed.data.email);
      if (!record || !record.password_hash || !record.is_active) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const validPassword = await verifyPassword(parsed.data.password, record.password_hash);
      if (!validPassword) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const token = signAuthToken(
        {
          userId: record.id,
          organizationId: record.organization_id,
          email: record.email,
          role: record.role,
          exp: Date.now() + 1000 * 60 * 60,
        },
        config.authTokenSecret
      );

      const user = await ctx.repos.users.findById(ctx.organizationId, record.id);
      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      const access = serializeAccess(
        await loadAccessScope(
          ctx.organizationId,
          {
            userId: user.id,
            organizationId: ctx.organizationId,
            email: user.email,
            role: user.role,
            exp: 0,
          },
          ctx.repos
        )
      );

      res.json({ token, user, access });
    })
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const token = readBearerToken(req.headers.authorization);
      if (!token) {
        throw new UnauthorizedError('Authentication required');
      }

      const payload = verifyAuthToken(token, config.authTokenSecret);
      if (!payload) {
        throw new UnauthorizedError('Invalid or expired authentication token');
      }

      const user = await ctx.repos.users.findById(payload.organizationId, payload.userId);
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      const access = serializeAccess(
        await loadAccessScope(payload.organizationId, payload, ctx.repos)
      );

      res.json({ user, access });
    })
  );

  router.patch(
    '/me',
    asyncHandler(async (req, res) => {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const token = readBearerToken(req.headers.authorization);
      if (!token) {
        throw new UnauthorizedError('Authentication required');
      }

      const payload = verifyAuthToken(token, config.authTokenSecret);
      if (!payload) {
        throw new UnauthorizedError('Invalid or expired authentication token');
      }

      if (parsed.data.password) {
        const record = await ctx.repos.users.findByEmailWithPasswordHash(
          payload.organizationId,
          payload.email
        );
        if (!record?.password_hash) {
          throw new UnauthorizedError('Current password is incorrect');
        }
        const valid = await verifyPassword(parsed.data.currentPassword!, record.password_hash);
        if (!valid) {
          throw new UnauthorizedError('Current password is incorrect');
        }
      }

      if (parsed.data.email) {
        const taken = await ctx.repos.users.findByEmail(payload.organizationId, parsed.data.email);
        if (taken && taken.id !== payload.userId) {
          throw new BadRequestError(`User with email "${parsed.data.email}" already exists`);
        }
      }

      const updateData: {
        email?: string;
        displayName?: string | null;
        passwordHash?: string;
      } = {};

      if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
      if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
      if (parsed.data.password) {
        updateData.passwordHash = await hashPassword(parsed.data.password);
      }

      const user = await ctx.repos.users.update(payload.organizationId, payload.userId, updateData);
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      res.json({ user });
    })
  );

  router.post(
    '/forgot-password',
    asyncHandler(async (req, res) => {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const generic = {
        message:
          'If an account exists for that email, the administrator has been notified. Check your inbox or contact your HydroFoil admin.',
        smtpConfigured: isSmtpConfigured(),
      };

      const user = await ctx.repos.users.findByEmail(ctx.organizationId, parsed.data.email);
      if (user?.isActive) {
        const loginUrl = `${config.publicAppUrl}/login`;
        await sendMail({
          to: config.smtpAdminTo,
          subject: `[HydroFoil] Password help requested — ${parsed.data.email}`,
          text: [
            `A password reset was requested for ${parsed.data.email}.`,
            '',
            'HydroFoil does not email passwords automatically yet. Reset the user password from',
            'Admin → Users, or ask them to update it under My profile after you set a temporary password.',
            '',
            `Console: ${loginUrl}`,
          ].join('\n'),
        });

        await sendMail({
          to: parsed.data.email,
          subject: 'HydroFoil password help',
          text: [
            'We received a request to help with your HydroFoil password.',
            '',
            'An administrator will follow up, or sign in after they send you a new temporary password.',
            `Sign in: ${loginUrl}`,
          ].join('\n'),
        });
      }

      res.json(generic);
    })
  );

  router.post(
    '/request-access',
    asyncHandler(async (req, res) => {
      const parsed = requestAccessSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(formatZodError(parsed.error));
      }

      const who = parsed.data.displayName?.trim()
        ? `${parsed.data.displayName.trim()} <${parsed.data.email}>`
        : parsed.data.email;

      const bodyLines = [
        `Access requested for HydroFoil.`,
        '',
        `Contact: ${who}`,
        parsed.data.message?.trim() ? `\nMessage:\n${parsed.data.message.trim()}` : '',
        '',
        `Invite them from Admin → Users (moderator, admin, or super-admin).`,
        `Console: ${config.publicAppUrl}/login`,
      ].filter(Boolean);

      const mailed = await sendMail({
        to: config.smtpAdminTo,
        subject: `[HydroFoil] Access request — ${parsed.data.email}`,
        text: bodyLines.join('\n'),
      });

      res.json({
        message: mailed
          ? 'Your request was sent to the administrator.'
          : 'Your request was recorded. SMTP is not configured — ask your administrator directly.',
        smtpConfigured: isSmtpConfigured(),
        delivered: mailed,
      });
    })
  );

  return router;
}
