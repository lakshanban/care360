import jwt from "jsonwebtoken";
export const COOKIE_NAME = "care360_token";
export const PREAUTH_COOKIE_NAME = "care360_preauth";
function secret() {
    const s = process.env.JWT_SECRET;
    if (s && s.length >= 16)
        return s;
    if (process.env.NODE_ENV !== "production") {
        return "care360-dev-jwt-secret-min-16chars";
    }
    throw new Error("JWT_SECRET must be set (min 16 chars). Set in care360-app/server/.env");
}
export function signAuthToken(input) {
    const payload = {
        sub: input.userId,
        email: input.email,
        roles: input.roles,
        activeRole: input.activeRole,
        typ: "auth",
    };
    return jwt.sign(payload, secret(), { expiresIn: "7d" });
}
export function signPreAuthToken(input) {
    const payload = {
        sub: input.userId,
        email: input.email,
        roles: input.roles,
        typ: "preauth",
    };
    return jwt.sign(payload, secret(), { expiresIn: "15m" });
}
/** Parses auth JWT; supports legacy tokens that only had `role` (single). */
export function verifyAuthToken(token) {
    const decoded = jwt.verify(token, secret());
    if (decoded.typ === "preauth") {
        throw new Error("Invalid token type");
    }
    let roles = decoded.roles;
    let activeRole = decoded.activeRole;
    const legacyRole = decoded.role;
    if (!roles?.length && legacyRole) {
        roles = [legacyRole];
    }
    if (!activeRole && legacyRole) {
        activeRole = legacyRole;
    }
    if (!activeRole && roles?.length) {
        activeRole = roles[0];
    }
    const sub = decoded.sub;
    const email = decoded.email;
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
export function verifyPreAuthToken(token) {
    const decoded = jwt.verify(token, secret());
    if (decoded.typ !== "preauth") {
        throw new Error("Invalid token type");
    }
    const roles = decoded.roles;
    const sub = decoded.sub;
    const email = decoded.email;
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
