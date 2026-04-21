import { COOKIE_NAME, verifyAuthToken, } from "../lib/jwt.js";
import { findUserById, resolveActiveRole } from "../store/userStore.js";
function getToken(req) {
    const cookie = req.cookies?.[COOKIE_NAME];
    if (cookie)
        return cookie;
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer "))
        return h.slice(7);
    return undefined;
}
export function requireAuth(req, res, next) {
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
        }
        catch {
            res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token" });
        }
    })();
}
export function requireRoles(...roles) {
    return (req, res, next) => {
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
