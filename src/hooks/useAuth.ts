import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export { useAuth };

export function usePermissions() {
  const { role, profile, isConfigured } = useAuth();

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isViewer = role === 'VIEWER';

  const canManageLetters = isSuperAdmin || isAdmin;
  const canManageUsers = isSuperAdmin;
  const canManageSettings = isSuperAdmin;
  const canManageMasterData = isSuperAdmin || isAdmin;
  const canVerifyLetters = isSuperAdmin || isAdmin;
  const canViewAuditLogs = isSuperAdmin;

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  return {
    role,
    profile,
    isSuperAdmin,
    isAdmin,
    isViewer,
    canManageLetters,
    canManageUsers,
    canManageSettings,
    canManageMasterData,
    canVerifyLetters,
    canViewAuditLogs,
    hasRole,
    isConfigured,
  };
}
