import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { getAllUsers } from "../store/userStore.js";
import type { CaregiverApplicationStatus } from "../types.js";
import {
  approveApplication,
  listApplicationsByStatus,
  rejectApplication,
} from "../store/caregiverApplicationStore.js";
import { APPLICATION_STATUS, USER_ROLE } from "../constants.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles(USER_ROLE.ADMIN));

router.get("/stats", async (_req, res) => {
  const users = await getAllUsers();
  const byRole = {
    admin: users.filter((u) => u.roles.includes(USER_ROLE.ADMIN)).length,
    caregiver: users.filter((u) => u.roles.includes(USER_ROLE.CAREGIVER)).length,
    client: users.filter((u) => u.roles.includes(USER_ROLE.CLIENT)).length,
  };
  const pendingCaregivers = users.filter(
    (u) =>
      u.roles.includes(USER_ROLE.CAREGIVER) &&
      u.caregiverOnboardingStatus === APPLICATION_STATUS.PENDING,
  ).length;
  res.json({
    totalUsers: users.length,
    byRole,
    pendingCaregiverApplications: pendingCaregivers,
    scoringEngineVersion: "1.0",
    environment: process.env.NODE_ENV ?? "development",
  });
});

router.get("/users", async (_req, res) => {
  const users = await getAllUsers();
  res.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: u.roles,
      name: u.name,
      caregiverOnboardingStatus: u.caregiverOnboardingStatus,
      createdAt: u.createdAt,
    })),
  });
});

router.get("/caregiver-applications", async (req, res) => {
  const raw = req.query.status as string | undefined;
  const status: CaregiverApplicationStatus | "all" =
    raw === APPLICATION_STATUS.ALL
      ? APPLICATION_STATUS.ALL
      : raw === APPLICATION_STATUS.APPROVED
        ? APPLICATION_STATUS.APPROVED
        : raw === APPLICATION_STATUS.REJECTED
          ? APPLICATION_STATUS.REJECTED
          : APPLICATION_STATUS.PENDING;
  const applications = await listApplicationsByStatus(status);
  res.json({ applications });
});

router.post(
  "/caregiver-applications/:userId/approve",
  async (req: AuthedRequest, res) => {
    try {
      await approveApplication(req.params.userId, req.userId!);
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_PENDING") {
        res.status(400).json({
          error: "INVALID_STATE",
          message: "No pending application for this user.",
        });
        return;
      }
      throw e;
    }
  },
);

router.post(
  "/caregiver-applications/:userId/reject",
  async (req: AuthedRequest, res) => {
    const { reason } = req.body as { reason?: string };
    try {
      await rejectApplication(req.params.userId, req.userId!, reason);
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof Error && e.message === "NOT_PENDING") {
        res.status(400).json({
          error: "INVALID_STATE",
          message: "No pending application for this user.",
        });
        return;
      }
      throw e;
    }
  },
);

export default router;
