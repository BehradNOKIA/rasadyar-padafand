/**
 * Rasadyar role and permission model.
 *
 * UI permissions improve usability, but protected backend operations
 * must enforce authorization again on the server.
 */

export type RasadyarRole =
  | "superadmin"
  | "admin"
  | "analyst"
  | "viewer";

export type RasadyarPermission =
  | "dashboard.view"
  | "map.view"
  | "analysis.view"
  | "analysis.create"
  | "analysis.edit"
  | "report.view"
  | "report.create"
  | "report.edit"
  | "report.publish"
  | "report.delete"
  | "users.manage"
  | "users.create"
  | "users.edit"
  | "users.delete"
  | "system.settings"
  | "profile.edit";

const SUPERADMIN_PERMISSIONS: readonly RasadyarPermission[] = [
  "dashboard.view",
  "map.view",

  "analysis.view",
  "analysis.create",
  "analysis.edit",

  "report.view",
  "report.create",
  "report.edit",
  "report.publish",
  "report.delete",

  "users.manage",
  "users.create",
  "users.edit",
  "users.delete",

  "system.settings",
  "profile.edit",
];

const ADMIN_PERMISSIONS: readonly RasadyarPermission[] = [
  "dashboard.view",
  "map.view",

  "analysis.view",
  "analysis.create",
  "analysis.edit",

  "report.view",
  "report.create",
  "report.edit",
  "report.publish",
  "report.delete",

  "users.manage",
  "users.create",
  "users.edit",
  "users.delete",

  "system.settings",
  "profile.edit",
];

const ANALYST_PERMISSIONS: readonly RasadyarPermission[] = [
  "dashboard.view",
  "map.view",

  "analysis.view",
  "analysis.create",
  "analysis.edit",

  "report.view",
  "report.create",
  "report.edit",

  "profile.edit",
];

const VIEWER_PERMISSIONS: readonly RasadyarPermission[] = [
  "dashboard.view",
  "map.view",

  "report.view",

  "profile.edit",
];

export const ROLE_PERMISSIONS: Readonly<
  Record<RasadyarRole, readonly RasadyarPermission[]>
> = {
  superadmin: SUPERADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  analyst: ANALYST_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

export function normalizeRole(
  value: unknown,
): RasadyarRole | null {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "superadmin":
      return "superadmin";

    case "admin":
      return "admin";

    case "analyst":
      return "analyst";

    case "viewer":
      return "viewer";

    default:
      return null;
  }
}

export function getRolePermissions(
  role: unknown,
): RasadyarPermission[] {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return [];
  }

  return [
    ...ROLE_PERMISSIONS[normalizedRole],
  ];
}

export function isRasadyarPermission(
  value: unknown,
): value is RasadyarPermission {
  return (
    typeof value === "string" &&
    SUPERADMIN_PERMISSIONS.includes(
      value as RasadyarPermission,
    )
  );
}
