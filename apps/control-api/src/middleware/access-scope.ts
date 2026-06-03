import type { Request, Response, NextFunction } from 'express';
import type { AppContext } from '../context';
import { loadAccessScope } from '../lib/access-control';

export function createAccessScopeMiddleware(ctx: AppContext) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      next();
      return;
    }
    try {
      req.accessScope = await loadAccessScope(ctx.organizationId, req.authUser, ctx.repos);
      next();
    } catch (error) {
      next(error);
    }
  };
}
