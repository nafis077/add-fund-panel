import type { Permission, UserRole } from "@/types/domain";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "panels.manage",
    "payments.view",
    "payments.create",
    "payments.approve",
    "payments.retry",
    "payments.cancel",
    "settings.manage",
    "admins.manage",
  ],
  ADMIN: [
    "panels.manage",
    "payments.view",
    "payments.create",
    "payments.approve",
    "payments.retry",
    "payments.cancel",
    "settings.manage",
  ],
  OPERATOR: ["payments.view", "payments.create", "payments.retry"],
  VIEWER: ["payments.view"],
};

export function permissionsFor(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthError(`Missing permission: ${permission}`);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
