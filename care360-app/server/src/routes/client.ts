import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);
router.use(requireRoles("client"));

router.get("/journey", (_req: AuthedRequest, res) => {
  res.json({
    activeStage: "match",
    urgency: "scheduled",
    bookings: [
      {
        id: "bk_1",
        status: "confirmed",
        caregiverName: "Assigned after match",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
  });
});

router.get("/bookings", (_req, res) => {
  res.json({
    items: [
      {
        id: "bk_1",
        reference: "C360-BK-1001",
        status: "confirmed",
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

export default router;
