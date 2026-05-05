export type UserRole = 'director' | 'manager' | 'member' | 'viewer' | 'admin' | 'lead'; // keeping admin/lead for backward compatibility

export function isDirector(role: string | null | undefined): boolean {
  if (!role) return false;
  const currentRole = role.toLowerCase();
  return currentRole === 'director' || currentRole === 'admin';
}

export function isManager(role: string | null | undefined): boolean {
  if (!role) return false;
  const currentRole = role.toLowerCase();
  return currentRole === 'manager' || currentRole === 'lead';
}

export function isMember(role: string | null | undefined): boolean {
  if (!role) return false;
  const currentRole = role.toLowerCase();
  return currentRole === 'member';
}

export function isViewer(role: string | null | undefined): boolean {
  if (!role) return false;
  const currentRole = role.toLowerCase();
  return currentRole === 'viewer';
}

// Logic cho phép quản lý user
export function canManageUser(currentUserRole: string | null | undefined): boolean {
  return isDirector(currentUserRole) || isManager(currentUserRole);
}

// Giám đốc xem được hết, Manager xem được cùng department
export function canViewUser(
  currentUserRole: string | null | undefined, 
  currentUserDeptId: string | null | undefined, 
  targetUserDeptId: string | null | undefined
): boolean {
  if (isDirector(currentUserRole)) return true;
  if (isManager(currentUserRole)) {
    return currentUserDeptId === targetUserDeptId;
  }
  return false;
}

// Tương tự cho xem Department
export function canViewDepartment(
  currentUserRole: string | null | undefined, 
  currentUserDeptId: string | null | undefined, 
  targetDeptId: string | null | undefined
): boolean {
  if (isDirector(currentUserRole)) return true;
  if (isManager(currentUserRole)) {
    return currentUserDeptId === targetDeptId;
  }
  return false;
}

// Quyền quản lý KPI
export function canCreateKPI(currentUserRole: string | null | undefined): boolean {
  return isDirector(currentUserRole) || isManager(currentUserRole);
}

export function canEditKPI(
  currentUserRole: string | null | undefined,
  currentUserDeptId: string | null | undefined,
  targetKpiDeptId: string | null | undefined
): boolean {
  if (isDirector(currentUserRole)) return true;
  if (isManager(currentUserRole)) {
    return currentUserDeptId === targetKpiDeptId;
  }
  return false;
}

export function canDeleteKPI(
  currentUserRole: string | null | undefined,
  currentUserDeptId: string | null | undefined,
  targetKpiDeptId: string | null | undefined
): boolean {
  return canEditKPI(currentUserRole, currentUserDeptId, targetKpiDeptId);
}

// Quyền quản lý Item
export function canCreateKPIItem(
  currentUserRole: string | null | undefined,
  currentUserDeptId: string | null | undefined,
  targetKpiDeptId: string | null | undefined
): boolean {
  return canEditKPI(currentUserRole, currentUserDeptId, targetKpiDeptId);
}

export function canDeleteKPIItem(
  currentUserRole: string | null | undefined,
  currentUserDeptId: string | null | undefined,
  targetKpiDeptId: string | null | undefined
): boolean {
  return canEditKPI(currentUserRole, currentUserDeptId, targetKpiDeptId);
}

// The item update UI has fields actual/manual_progress/note. Only those can be updated by owner.
export function canEditKPIItem(
  currentUserRole: string | null | undefined,
  currentUserDeptId: string | null | undefined,
  targetKpiDeptId: string | null | undefined,
  currentUserId: string | null | undefined,
  kpiOwnerId: string | null | undefined
): { canEditAll: boolean; canEditActual: boolean } {
  const isKpiOwner = !!(currentUserId && kpiOwnerId && currentUserId === kpiOwnerId);
  const isAuthorizedManager = isDirector(currentUserRole) || (isManager(currentUserRole) && currentUserDeptId === targetKpiDeptId);

  return {
    canEditAll: isAuthorizedManager,
    canEditActual: isAuthorizedManager || isKpiOwner
  };
}
