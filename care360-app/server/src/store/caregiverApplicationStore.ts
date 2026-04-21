import type {
  CaregiverApplicationDTO,
  CaregiverApplicationListItem,
  CaregiverApplicationStatus,
} from "../types.js";
import { findUserById, setUserCaregiverOnboardingStatus } from "./userStore.js";

type MemApp = CaregiverApplicationDTO;
const applications: MemApp[] = [];
let appSeq = 2000;

export async function getApplicationByUserId(
  userId: string,
): Promise<CaregiverApplicationDTO | null> {
  return applications.find((a) => a.userId === userId) ?? null;
}

export async function submitCaregiverApplication(input: {
  userId: string;
  nationalId: string;
  skills: string[];
  experience: string;
}): Promise<CaregiverApplicationDTO> {
  const nationalId = input.nationalId.trim();
  const experience = input.experience.trim();
  if (!nationalId || !experience) {
    throw new Error("VALIDATION");
  }
  const skills = [...new Set(input.skills.map((s) => s.trim()).filter(Boolean))];
  if (skills.length === 0) {
    throw new Error("VALIDATION");
  }

  let app = applications.find((a) => a.userId === input.userId);
  const now = new Date().toISOString();
  if (!app) {
    app = {
      id: `app-${appSeq++}`,
      userId: input.userId,
      nationalId,
      skills,
      experience,
      status: "pending",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    applications.push(app);
  } else {
    app.nationalId = nationalId;
    app.skills = skills;
    app.experience = experience;
    app.status = "pending";
    app.reviewedAt = null;
    app.reviewedBy = null;
    app.rejectionReason = null;
    app.updatedAt = now;
  }

  await setUserCaregiverOnboardingStatus(input.userId, "pending");
  return app;
}

export async function listApplicationsByStatus(
  status: CaregiverApplicationStatus | "all",
): Promise<CaregiverApplicationListItem[]> {
  const rows =
    status === "all"
      ? [...applications]
      : applications.filter((a) => a.status === status);
  rows.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));

  const out: CaregiverApplicationListItem[] = [];
  for (const app of rows) {
    const user = await findUserById(app.userId);
    if (!user) continue;
    out.push({
      ...app,
      applicantName: user.name,
      applicantEmail: user.email,
    });
  }
  return out;
}

export async function approveApplication(
  applicationUserId: string,
  adminUserId: string,
): Promise<void> {
  const app = applications.find((a) => a.userId === applicationUserId);
  if (!app || app.status !== "pending") {
    throw new Error("NOT_PENDING");
  }
  app.status = "approved";
  app.reviewedAt = new Date().toISOString();
  app.reviewedBy = adminUserId;
  app.rejectionReason = null;
  app.updatedAt = new Date().toISOString();
  await setUserCaregiverOnboardingStatus(applicationUserId, "active");
}

export async function rejectApplication(
  applicationUserId: string,
  adminUserId: string,
  reason?: string,
): Promise<void> {
  const app = applications.find((a) => a.userId === applicationUserId);
  if (!app || app.status !== "pending") {
    throw new Error("NOT_PENDING");
  }
  app.status = "rejected";
  app.reviewedAt = new Date().toISOString();
  app.reviewedBy = adminUserId;
  app.rejectionReason = reason?.trim() || "Application not approved.";
  app.updatedAt = new Date().toISOString();
  await setUserCaregiverOnboardingStatus(applicationUserId, "rejected");
}
