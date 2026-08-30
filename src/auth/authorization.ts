import {
  can,
  type RasadyarAccessUser,
} from './accessControl';

import type {
  RasadyarPermission,
} from './permissions';

export function canAccess(
  user: RasadyarAccessUser,
  permission: RasadyarPermission,
): boolean {
  return can(user, permission);
}

export function isSuperAdmin(
  user: RasadyarAccessUser,
): boolean {
  return user?.role === 'superadmin';
}

export function isAnalyst(
  user: RasadyarAccessUser,
): boolean {
  return user?.role === 'analyst';
}

export function isViewer(
  user: RasadyarAccessUser,
): boolean {
  return user?.role === 'viewer';
}
