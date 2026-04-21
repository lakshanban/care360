export type UserRole = "admin" | "caregiver" | "client";

/** Caregiver access to the marketplace / full portal (Milestone 2). */
export type CaregiverOnboardingStatus =
  | "none"
  | "not_applied"
  | "pending"
  | "active"
  | "rejected";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  name: string;
  createdAt: string;
  caregiverOnboardingStatus: CaregiverOnboardingStatus;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  /** Currently selected role for this session (JWT). */
  activeRole: UserRole;
  /**
   * When the user has the caregiver role: onboarding gate for applications.
   * `none` if they are not a caregiver.
   */
  caregiverOnboardingStatus: CaregiverOnboardingStatus;
}

export interface RoleSelectionInfo {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

export interface JwtAuthPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
  typ: "auth";
  iat?: number;
  exp?: number;
}

export interface JwtPreAuthPayload {
  sub: string;
  email: string;
  roles: UserRole[];
  typ: "preauth";
  iat?: number;
  exp?: number;
}

export type CaregiverApplicationStatus = "pending" | "approved" | "rejected";

export interface CaregiverApplicationDTO {
  id: string;
  userId: string;
  nationalId: string;
  skills: string[];
  experience: string;
  status: CaregiverApplicationStatus;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverApplicationListItem extends CaregiverApplicationDTO {
  applicantName: string;
  applicantEmail: string;
}
