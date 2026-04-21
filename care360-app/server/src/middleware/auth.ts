import type { Request, Response, NextFunction } from "express";
import {
  COOKIE_NAME,
  verifyAuthToken,
} from "../lib/jwt.js";
import type { UserRole } from "../types.js";
import { findUserById, resolveActiveRole } from "../store/userStore.js";

export interface AuthedRequest extends Request {
  userId?: string;
  /** Active role for this request (from JWT, validated against DB). */
  userActiveRole?: UserRole;
  userRoles?: UserRole[];
  userEmail?: string;
  /** @deprecated Use userActiveRole */
  userRole?: UserRole;
}

function getToken(req: Request): string | undefined {
  const cookie = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (cookie) return cookie;
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return undefined;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  void (async () => {
    try {
      const token = getToken(req);
      if (!token) {
        res
          .status(401)
          .json({ error: "UNAUTHORIZED", message: "Sign in required" });
        return;
      }
      const payload = verifyAuthToken(token);
      const user = await findUserById(payload.sub);
      if (!user) {
        res
          .status(401)
          .json({ error: "UNAUTHORIZED", message: "Invalid session" });
        return;
      }
      const activeRole = resolveActiveRole(user, payload.activeRole);
      req.userId = user.id;
      req.userRoles = user.roles;
      req.userActiveRole = activeRole;
      req.userRole = activeRole;
      req.userEmail = user.email;
      next();
    } catch {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
    }
  })();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const ar = req.userActiveRole ?? req.userRole;
    if (!ar || !roles.includes(ar)) {
      res
        .status(403)
        .json({ error: "FORBIDDEN", message: "Insufficient role" });
      return;
    }
    next();
  };
}
