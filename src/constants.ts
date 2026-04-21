import type { CaregiverApplicationStatus, UserRole } from "./types.js";

export const USER_ROLE = {
  ADMIN: "admin" as UserRole,
  CAREGIVER: "caregiver" as UserRole,
  CLIENT: "client" as UserRole,
} as const;

export const APPLICATION_STATUS = {
  PENDING: "pending" as CaregiverApplicationStatus,
  APPROVED: "approved" as CaregiverApplicationStatus,
  REJECTED: "rejected" as CaregiverApplicationStatus,
  ALL: "all" as const,
} as const;
