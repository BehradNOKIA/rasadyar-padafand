import {
  getRolePermissions,
  normalizeRole,
  type RasadyarPermission,
} from "./permissions";

export type RasadyarAccessUser = {
  role?: unknown;
  active?: boolean;
  permissions?: readonly RasadyarPermission[];
} | null | undefined;

/**
 * Returns the effective permissions for a UI user.
 *
 * Role permissions are the canonical client-side RBAC model.
 * If a sanitized server profile contains an explicit permissions
 * array, it is treated as an additional restriction rather than
 * a way to elevate privileges.
 */
export function getEffectivePermissions(
  user: RasadyarAccessUser,
): RasadyarPermission[] {
  if (!user || user.active === false) {
    return [];
  }

  const role = normalizeRole(user.role);

  if (!role) {
    return [];
  }

  const rolePermissions =
    getRolePermissions(role);

  if (!Array.isArray(user.permissions)) {
    return rolePermissions;
  }

  const explicit =
    new Set(user.permissions);

  return rolePermissions.filter(
    (permission) =>
      explicit.has(permission),
  );
}

export function can(
  user: RasadyarAccessUser,
  permission: RasadyarPermission,
): boolean {
  if (!user || user.active === false) {
    return false;
  }

  const role = normalizeRole(user.role);

  if (!role) {
    return false;
  }

  /*
   * superadmin remains the protected root role.
   * The backend must independently enforce the same rule.
   */
  if (role === "superadmin") {
    return true;
  }

  return getEffectivePermissions(user).includes(
    permission,
  );
}

export function hasAny(
  user: RasadyarAccessUser,
  permissions:
    readonly RasadyarPermission[],
): boolean {
  return permissions.some(
    (permission) =>
      can(user, permission),
  );
}

export function hasAll(
  user: RasadyarAccessUser,
  permissions:
    readonly RasadyarPermission[],
): boolean {
  return permissions.every(
    (permission) =>
      can(user, permission),
  );
}
