import jwt from "jsonwebtoken";
import type { JwtAuthPayload, JwtPreAuthPayload, UserRole } from "../types.js";

export const COOKIE_NAME = "care360_token";
export const PREAUTH_COOKIE_NAME = "care360_preauth";

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV !== "production") {
    return "care360-dev-jwt-secret-min-16chars";
  }
  throw new Error("JWT_SECRET must be set (min 16 chars). Set in care360-app/server/.env");
}

export function signAuthToken(input: {
  userId: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
}): string {
  const payload: JwtAuthPayload = {
    sub: input.userId,
    email: input.email,
    roles: input.roles,
    activeRole: input.activeRole,
    typ: "auth",
  };
  return jwt.sign(payload, secret(), { expiresIn: "7d" });
}

export function signPreAuthToken(input: {
  userId: string;
  email: string;
  roles: UserRole[];
}): string {
  const payload: JwtPreAuthPayload = {
    sub: input.userId,
    email: input.email,
    roles: input.roles,
    typ: "preauth",
  };
  return jwt.sign(payload, secret(), { expiresIn: "15m" });
}

/** Parses auth JWT; supports legacy tokens that only had `role` (single). */
export function verifyAuthToken(token: string): JwtAuthPayload {
  const decoded = jwt.verify(token, secret()) as Record<string, unknown>;
  if (decoded.typ === "preauth") {
    throw new Error("Invalid token type");
  }
  let roles = decoded.roles as UserRole[] | undefined;
  let activeRole = decoded.activeRole as UserRole | undefined;
  const legacyRole = decoded.role as UserRole | undefined;
  if (!roles?.length && legacyRole) {
    roles = [legacyRole];
  }
  if (!activeRole && legacyRole) {
    activeRole = legacyRole;
  }
  if (!activeRole && roles?.length) {
    activeRole = roles[0];
  }
  const sub = decoded.sub as string | undefined;
  const email = decoded.email as string | undefined;
  if (!sub || !email || !roles?.length || !activeRole) {
    throw new Error("Invalid token payload");
  }
  return {
    sub,
    email,
    roles,
    activeRole,
    typ: "auth",
  };
}

export function verifyPreAuthToken(token: string): JwtPreAuthPayload {
  const decoded = jwt.verify(token, secret()) as Record<string, unknown>;
  if (decoded.typ !== "preauth") {
    throw new Error("Invalid token type");
  }
  const roles = decoded.roles as UserRole[] | undefined;
  const sub = decoded.sub as string | undefined;
  const email = decoded.email as string | undefined;
  if (!sub || !email || !roles?.length) {
    throw new Error("Invalid pre-auth payload");
  }
  return {
    sub,
    email,
    roles,
    typ: "preauth",
  };
}
