import { findUserById } from "../store/userStore.js";
/** Requires approved (active) caregiver onboarding — e.g. registration uploads. */
export function requireActiveCaregiver(req, res, next) {
    void (async () => {
        const user = await findUserById(req.userId);
        if (!user?.roles.includes("caregiver")) {
            res.status(403).json({
                error: "FORBIDDEN",
                message: "Caregiver role required",
            });
            return;
        }
        if (user.caregiverOnboardingStatus !== "active") {
            res.status(403).json({
                error: "FORBIDDEN",
                message: "Your caregiver application must be approved before registration uploads.",
            });
            return;
        }
        next();
    })();
}
