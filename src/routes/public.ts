import { Router } from "express";
import { UserModel } from "../models/User.js";

const router = Router();

/** Approved caregivers only (for directory / browse). */
router.get("/caregivers", async (_req, res) => {
  const docs = await UserModel.find({
    roles: { $in: ["caregiver"] },
    caregiverOnboardingStatus: "active",
  })
    .select({ name: 1 })
    .sort({ name: 1 })
    .lean<{ _id: unknown; name: string }[]>();
  res.json({
    caregivers: docs.map((d) => ({
      id: String(d._id),
      name: d.name,
    })),
  });
});

/** Public scoring summary (same as product docs) */
router.get("/scoring-summary", (_req, res) => {
  res.json({
    maxScore: 100,
    categories: [
      { name: "Education", max: 30, bands: ["30", "20", "10"] },
      { name: "Experience", max: 40, bands: ["40", "35", "25", "15"] },
      { name: "Trust & Safety", max: 20, bands: ["15", "5"] },
      { name: "Interview", max: 10, bands: ["10"] },
    ],
    tiers: [
      { name: "Platinum", range: "85–100", pay: "High" },
      { name: "Gold", range: "65–84", pay: "Standard" },
      { name: "Silver", range: "40–64", pay: "Entry" },
      { name: "Fail / Retrain", range: "Below 40", pay: "—" },
    ],
  });
});

export default router;
