import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { findUserById } from "../store/userStore.js";
import {
  getApplicationByUserId,
  submitCaregiverApplication,
} from "../store/caregiverApplicationStore.js";
import { USER_ROLE } from "../constants.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles(USER_ROLE.CAREGIVER));

/** Submit or update caregiver application (ID, skills, experience). */
router.post("/application", async (req: AuthedRequest, res) => {
  const user = await findUserById(req.userId!);
  if (!user?.roles.includes(USER_ROLE.CAREGIVER)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Not a caregiver" });
    return;
  }
  if (user.caregiverOnboardingStatus === "active") {
    res.status(400).json({
      error: "ALREADY_ACTIVE",
      message: "Your caregiver account is already approved.",
    });
    return;
  }
  if (user.caregiverOnboardingStatus === "pending") {
    res.status(400).json({
      error: "PENDING_REVIEW",
      message: "Your application is already awaiting review.",
    });
    return;
  }
  const body = req.body as {
    nationalId?: string;
    skills?: unknown;
    experience?: string;
  };
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((s): s is string => typeof s === "string")
    : typeof body.skills === "string"
      ? body.skills.split(/[,\n]/).map((s) => s.trim())
      : [];
  try {
    const application = await submitCaregiverApplication({
      userId: user.id,
      nationalId: body.nationalId ?? "",
      skills,
      experience: body.experience ?? "",
    });
    res.status(201).json({ application });
  } catch (e) {
    if (e instanceof Error && e.message === "VALIDATION") {
      res.status(400).json({
        error: "VALIDATION",
        message: "National ID, at least one skill, and experience are required.",
      });
      return;
    }
    throw e;
  }
});

/** Current user's application + onboarding status */
router.get("/application/me", async (req: AuthedRequest, res) => {
  const user = await findUserById(req.userId!);
  if (!user?.roles.includes(USER_ROLE.CAREGIVER)) {
    res.status(403).json({ error: "FORBIDDEN", message: "Not a caregiver" });
    return;
  }
  const application = await getApplicationByUserId(user.id);
  res.json({
    caregiverOnboardingStatus: user.caregiverOnboardingStatus,
    application,
  });
});

router.get("/profile-summary", (req: AuthedRequest, res) => {
  res.json({
    name: "Profile",
    tier: "gold",
    scorePreview: 72,
    email: req.userEmail,
  });
});

export default router;
