import { Router } from "express";
import type { Response } from "express";
import {
  COOKIE_NAME,
  PREAUTH_COOKIE_NAME,
  signAuthToken,
  signPreAuthToken,
  verifyAuthToken,
  verifyPreAuthToken,
} from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  resolveActiveRole,
  toPublicUser,
} from "../store/userStore.js";
import type { UserRole } from "../types.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const PREAUTH_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 15 * 60 * 1000,
};

function parseRegisterRoles(body: {
  roles?: unknown;
  role?: unknown;
}): UserRole[] | null {
  if (Array.isArray(body.roles)) {
    const set = new Set<UserRole>();
    for (const r of body.roles) {
      if (r === "caregiver" || r === "client") set.add(r);
    }
    const out = [...set];
    return out.length ? out : null;
  }
  if (body.role === "caregiver" || body.role === "client") {
    return [body.role];
  }
  return null;
}

function needsRoleSelection(userRoles: UserRole[]): boolean {
  return userRoles.length > 1;
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    const regRoles = parseRegisterRoles(
      req.body as { roles?: unknown; role?: unknown },
    );
    if (!email || !password || !name || !regRoles) {
      res.status(400).json({ error: "VALIDATION", message: "Missing fields" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({
        error: "VALIDATION",
        message: "Password must be at least 8 characters",
      });
      return;
    }
    const user = await createUser({
      email,
      password,
      name,
      roles: regRoles,
    });
    if (needsRoleSelection(user.roles)) {
      const pre = signPreAuthToken({
        userId: user.id,
        email: user.email,
        roles: user.roles,
      });
      res.cookie(PREAUTH_COOKIE_NAME, pre, PREAUTH_OPTS);
      res.status(201).json({
        needsRoleSelection: true,
        roleSelection: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
        },
      });
      return;
    }
    const activeRole = user.roles[0];
    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      roles: user.roles,
      activeRole,
    });
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
    res.clearCookie(PREAUTH_COOKIE_NAME, { path: "/" });
    res.status(201).json({ user: toPublicUser(user, activeRole) });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_IN_USE") {
      res
        .status(409)
        .json({ error: "CONFLICT", message: "Email already registered" });
      return;
    }
    if (e instanceof Error && e.message === "INVALID_ROLES") {
      res
        .status(400)
        .json({ error: "VALIDATION", message: "Select caregiver and/or client" });
      return;
    }
    throw e;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res
      .status(400)
      .json({ error: "VALIDATION", message: "Email and password required" });
    return;
  }
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({
      error: "INVALID_CREDENTIALS",
      message: "Invalid email or password",
    });
    return;
  }
  if (needsRoleSelection(user.roles)) {
    const pre = signPreAuthToken({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });
    res.cookie(PREAUTH_COOKIE_NAME, pre, PREAUTH_OPTS);
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({
      needsRoleSelection: true,
      roleSelection: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
      },
    });
    return;
  }
  const activeRole = user.roles[0];
  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    roles: user.roles,
    activeRole,
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.clearCookie(PREAUTH_COOKIE_NAME, { path: "/" });
  res.json({ user: toPublicUser(user, activeRole) });
});

router.post("/select-role", async (req, res) => {
  const raw =
    (req.cookies?.[PREAUTH_COOKIE_NAME] as string | undefined) ?? "";
  const { activeRole } = req.body as { activeRole?: UserRole };
  if (!raw || !activeRole) {
    res.status(400).json({ error: "VALIDATION", message: "Missing selection" });
    return;
  }
  let payload;
  try {
    payload = verifyPreAuthToken(raw);
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Session expired" });
    return;
  }
  const user = await findUserById(payload.sub);
  if (!user || !user.roles.includes(activeRole)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Invalid role" });
    return;
  }
  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    roles: user.roles,
    activeRole,
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.clearCookie(PREAUTH_COOKIE_NAME, { path: "/" });
  res.json({ user: toPublicUser(user, activeRole) });
});

router.post("/switch-role", requireAuth, async (req: AuthedRequest, res) => {
  const { activeRole } = req.body as { activeRole?: UserRole };
  const user = await findUserById(req.userId!);
  if (!user || !activeRole || !user.roles.includes(activeRole)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Invalid role" });
    return;
  }
  if (user.roles.length < 2) {
    res.status(400).json({ error: "VALIDATION", message: "Nothing to switch" });
    return;
  }
  const token = signAuthToken({
    userId: user.id,
    email: user.email,
    roles: user.roles,
    activeRole,
  });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ user: toPublicUser(user, activeRole) });
});

router.post("/logout", (_req, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.clearCookie(PREAUTH_COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await findUserById(req.userId!);
  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const activeRole = resolveActiveRole(user, req.userActiveRole);
  res.json({ user: toPublicUser(user, activeRole) });
});

function getAuthCookie(req: import("express").Request): string | undefined {
  const c = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (c) return c;
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return undefined;
}

router.get("/session", async (req, res) => {
  const authTok = getAuthCookie(req);
  const preRaw = req.cookies?.[PREAUTH_COOKIE_NAME] as string | undefined;

  if (authTok) {
    try {
      const payload = verifyAuthToken(authTok);
      const user = await findUserById(payload.sub);
      if (!user) {
        res.json({ user: null, roleSelection: null });
        return;
      }
      const activeRole = resolveActiveRole(user, payload.activeRole);
      res.json({
        user: toPublicUser(user, activeRole),
        roleSelection: null,
      });
      return;
    } catch {
      res.json({ user: null, roleSelection: null });
      return;
    }
  }

  if (preRaw) {
    try {
      const payload = verifyPreAuthToken(preRaw);
      const user = await findUserById(payload.sub);
      if (!user) {
        res.json({ user: null, roleSelection: null });
        return;
      }
      res.json({
        user: null,
        roleSelection: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
        },
      });
      return;
    } catch {
      res.json({ user: null, roleSelection: null });
      return;
    }
  }

  res.json({ user: null, roleSelection: null });
});

export default router;
