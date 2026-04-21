import { hashPassword } from "../lib/password.js";
let users = [];
let seeded = false;
let seq = 1000;
/** One-time: legacy `role` → `roles`; default caregiver onboarding field. */
export async function migrateLegacyUserRoles() {
    await seedIfEmpty();
}
export async function migrateCaregiverOnboardingField() {
    await seedIfEmpty();
}
export async function seedIfEmpty() {
    if (seeded)
        return;
    const adminHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? "Care360Admin!");
    const demoCaregiverHash = await hashPassword("DemoCaregiver!");
    const demoClientHash = await hashPassword("DemoClient!");
    const demoBothHash = await hashPassword("DemoBoth!");
    const demoAdminCaregiverHash = await hashPassword("DemoAdminCaregiver!");
    const now = new Date().toISOString();
    users = [
        {
            id: "u-admin",
            email: "admin@care360.local",
            passwordHash: adminHash,
            roles: ["admin"],
            name: "System Admin",
            caregiverOnboardingStatus: "none",
            createdAt: now,
        },
        {
            id: "u-caregiver",
            email: "caregiver@care360.local",
            passwordHash: demoCaregiverHash,
            roles: ["caregiver"],
            name: "Demo Caregiver",
            caregiverOnboardingStatus: "active",
            createdAt: now,
        },
        {
            id: "u-client",
            email: "client@care360.local",
            passwordHash: demoClientHash,
            roles: ["client"],
            name: "Demo Client",
            caregiverOnboardingStatus: "none",
            createdAt: now,
        },
        {
            id: "u-both",
            email: "both@care360.local",
            passwordHash: demoBothHash,
            roles: ["caregiver", "client"],
            name: "Demo Caregiver + Client",
            caregiverOnboardingStatus: "active",
            createdAt: now,
        },
        {
            id: "u-admin-caregiver",
            email: "admin-caregiver@care360.local",
            passwordHash: demoAdminCaregiverHash,
            roles: ["admin", "caregiver"],
            name: "Demo Admin + Caregiver",
            caregiverOnboardingStatus: "active",
            createdAt: now,
        },
    ];
    seeded = true;
    console.log("Seeded in-memory demo users");
}
export async function findUserByEmail(email) {
    await seedIfEmpty();
    return users.find((u) => u.email === email.toLowerCase());
}
export async function findUserById(id) {
    await seedIfEmpty();
    return users.find((u) => u.id === id);
}
export async function getAllUsers() {
    await seedIfEmpty();
    return [...users];
}
const REGISTER_ROLES = ["caregiver", "client"];
export async function createUser(input) {
    await seedIfEmpty();
    const roles = input.roles.filter((r) => REGISTER_ROLES.includes(r));
    const unique = [...new Set(roles)];
    if (unique.length === 0) {
        throw new Error("INVALID_ROLES");
    }
    const hasCaregiver = unique.includes("caregiver");
    const email = input.email.toLowerCase();
    if (users.some((u) => u.email === email)) {
        throw new Error("EMAIL_IN_USE");
    }
    const user = {
        id: `u-${seq++}`,
        email,
        passwordHash: await hashPassword(input.password),
        roles: unique,
        name: input.name.trim(),
        caregiverOnboardingStatus: hasCaregiver ? "not_applied" : "none",
        createdAt: new Date().toISOString(),
    };
    users.push(user);
    return user;
}
export async function setUserCaregiverOnboardingStatus(userId, status) {
    await seedIfEmpty();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) {
        users[idx] = { ...users[idx], caregiverOnboardingStatus: status };
    }
}
export function toPublicUser(user, activeRole) {
    const ar = user.roles.includes(activeRole) ? activeRole : user.roles[0];
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        activeRole: ar,
        caregiverOnboardingStatus: user.roles.includes("caregiver")
            ? user.caregiverOnboardingStatus
            : "none",
    };
}
export function resolveActiveRole(user, preferred) {
    if (preferred && user.roles.includes(preferred))
        return preferred;
    return user.roles[0];
}
