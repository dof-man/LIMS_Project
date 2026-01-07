/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * This module provides reusable functions for checking user roles
 * and permissions throughout the application.
 */

// Define all available roles
export const Roles = {
  SUPERUSER: 'SUPERUSER',
  ADMIN: 'ADMIN',
  LAB_STAFF: 'LAB_STAFF',
  RECEPTION: 'RECEPTION',
};

// Role hierarchy (higher index = more permissions)
const roleHierarchy = [
  Roles.RECEPTION,
  Roles.LAB_STAFF,
  Roles.ADMIN,
  Roles.SUPERUSER,
];

/**
 * Get the priority level of a role (higher = more permissions)
 */
export function getRolePriority(role) {
  const index = roleHierarchy.indexOf(role);
  return index === -1 ? -1 : index;
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user, role) {
  if (!user || !user.role) {
    return false;
  }
  return user.role === role;
}

/**
 * Check if a user has any of the specified roles
 */
export function hasAnyRole(user, roles) {
  if (!user || !user.role) {
    return false;
  }
  
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return allowedRoles.includes(user.role);
}

/**
 * Check if a user has all of the specified roles (usually not applicable, but provided for completeness)
 */
export function hasAllRoles(user, roles) {
  if (!user || !user.role) {
    return false;
  }
  
  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  // Since a user can only have one role, this only returns true if there's exactly one required role
  return requiredRoles.length === 1 && requiredRoles[0] === user.role;
}

/**
 * Check if a user's role is at least as high as the minimum required role
 */
export function hasMinimumRole(user, minimumRole) {
  if (!user || !user.role) {
    return false;
  }
  
  const userPriority = getRolePriority(user.role);
  const minPriority = getRolePriority(minimumRole);
  
  return userPriority >= minPriority;
}

/**
 * Check if a user is an admin (ADMIN or SUPERUSER)
 */
export function isAdmin(user) {
  return hasAnyRole(user, [Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user is a superuser
 */
export function isSuperuser(user) {
  return hasRole(user, Roles.SUPERUSER);
}

/**
 * Check if a user is lab staff
 */
export function isLabStaff(user) {
  return hasRole(user, Roles.LAB_STAFF);
}

/**
 * Check if a user is reception
 */
export function isReception(user) {
  return hasRole(user, Roles.RECEPTION);
}

/**
 * Check if a user can manage other users
 * Only ADMIN and SUPERUSER can manage users
 */
export function canManageUsers(user) {
  return isAdmin(user);
}

/**
 * Check if a user can create a specific role
 * SUPERUSER can create any role
 * ADMIN can create ADMIN, LAB_STAFF, RECEPTION (but not SUPERUSER)
 */
export function canCreateRole(user, roleToCreate) {
  if (!user || !user.role) {
    return false;
  }
  
  if (isSuperuser(user)) {
    return true; // Superuser can create any role
  }
  
  if (hasRole(user, Roles.ADMIN)) {
    // Admin cannot create SUPERUSER
    return roleToCreate !== Roles.SUPERUSER;
  }
  
  return false; // Others cannot create users
}

/**
 * Check if a user can modify another user
 * Users can modify users with lower or equal role priority
 * SUPERUSER can modify anyone
 */
export function canModifyUser(currentUser, targetUser) {
  if (!currentUser || !currentUser.role || !targetUser || !targetUser.role) {
    return false;
  }
  
  if (isSuperuser(currentUser)) {
    return true; // Superuser can modify anyone
  }
  
  const currentPriority = getRolePriority(currentUser.role);
  const targetPriority = getRolePriority(targetUser.role);
  
  // Can modify users with lower priority, but not same or higher
  return currentPriority > targetPriority;
}

/**
 * Check if a user can delete another user
 * Same rules as canModifyUser, but more restrictive
 */
export function canDeleteUser(currentUser, targetUser) {
  if (!currentUser || !currentUser.role || !targetUser || !targetUser.role) {
    return false;
  }
  
  // Prevent deleting yourself
  if (currentUser.id === targetUser.id) {
    return false;
  }
  
  return canModifyUser(currentUser, targetUser);
}

/**
 * Check if a user can access patient records
 * All authenticated users can access patient records
 */
export function canAccessPatients(user) {
  return !!user && !!user.role;
}

/**
 * Check if a user can create/edit patient records
 * RECEPTION, ADMIN, and SUPERUSER can create/edit patients
 */
export function canModifyPatients(user) {
  return hasAnyRole(user, [Roles.RECEPTION, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can access lab results
 * All authenticated users can access lab results
 */
export function canAccessLabResults(user) {
  return !!user && !!user.role;
}

/**
 * Check if a user can create/edit lab results
 * LAB_STAFF, ADMIN, and SUPERUSER can create/edit lab results
 */
export function canModifyLabResults(user) {
  return hasAnyRole(user, [Roles.LAB_STAFF, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can verify lab results
 * LAB_STAFF, ADMIN, and SUPERUSER can verify results
 */
export function canVerifyLabResults(user) {
  return hasAnyRole(user, [Roles.LAB_STAFF, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can release lab results
 * LAB_STAFF, ADMIN, and SUPERUSER can release results
 */
export function canReleaseLabResults(user) {
  return hasAnyRole(user, [Roles.LAB_STAFF, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can manage inventory
 * ADMIN and SUPERUSER can manage inventory
 */
export function canManageInventory(user) {
  return isAdmin(user);
}

/**
 * Check if a user can view inventory
 * All authenticated users can view inventory
 */
export function canViewInventory(user) {
  return !!user && !!user.role;
}

/**
 * Check if a user can create orders
 * RECEPTION, ADMIN, and SUPERUSER can create orders
 */
export function canCreateOrders(user) {
  return hasAnyRole(user, [Roles.RECEPTION, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can process payments
 * RECEPTION, ADMIN, and SUPERUSER can process payments
 */
export function canProcessPayments(user) {
  return hasAnyRole(user, [Roles.RECEPTION, Roles.ADMIN, Roles.SUPERUSER]);
}

/**
 * Check if a user can view reports
 * ADMIN and SUPERUSER can view reports
 */
export function canViewReports(user) {
  return isAdmin(user);
}

/**
 * Check if a user can manage system settings
 * Only SUPERUSER can manage system settings
 */
export function canManageSettings(user) {
  return isSuperuser(user);
}

/**
 * Get a list of all roles a user can create
 */
export function getCreatableRoles(user) {
  if (!user || !user.role) {
    return [];
  }
  
  if (isSuperuser(user)) {
    return [Roles.SUPERUSER, Roles.ADMIN, Roles.LAB_STAFF, Roles.RECEPTION];
  }
  
  if (hasRole(user, Roles.ADMIN)) {
    return [Roles.ADMIN, Roles.LAB_STAFF, Roles.RECEPTION];
  }
  
  return [];
}

/**
 * Get all available roles
 */
export function getAllRoles() {
  return Object.values(Roles);
}

/**
 * Validate if a role is valid
 */
export function isValidRole(role) {
  return Object.values(Roles).includes(role);
}

/**
 * Get a human-readable description of a role
 */
export function getRoleDescription(role) {
  const descriptions = {
    [Roles.SUPERUSER]: 'System Administrator with full access',
    [Roles.ADMIN]: 'Administrator with management capabilities',
    [Roles.LAB_STAFF]: 'Laboratory Technician',
    [Roles.RECEPTION]: 'Front Desk / Reception Staff',
  };
  
  return descriptions[role] || 'Unknown Role';
}

/**
 * Get role badge color for UI
 */
export function getRoleColor(role) {
  const colors = {
    [Roles.SUPERUSER]: '#dc3545',
    [Roles.ADMIN]: '#007bff',
    [Roles.LAB_STAFF]: '#28a745',
    [Roles.RECEPTION]: '#ffc107',
  };
  
  return colors[role] || '#6c757d';
}

/**
 * Check multiple permissions at once
 * Returns an object with boolean values for each permission
 */
export function checkPermissions(user, permissions) {
  const results = {};
  
  for (const [key, checkFunction] of Object.entries(permissions)) {
    results[key] = typeof checkFunction === 'function' ? checkFunction(user) : false;
  }
  
  return results;
}

/**
 * Assert that a user has a specific role (throws error if not)
 */
export function assertRole(user, role, message) {
  if (!hasRole(user, role)) {
    throw new Error(message || `User must have ${role} role`);
  }
}

/**
 * Assert that a user has any of the specified roles (throws error if not)
 */
export function assertAnyRole(user, roles, message) {
  if (!hasAnyRole(user, roles)) {
    const roleList = Array.isArray(roles) ? roles.join(', ') : roles;
    throw new Error(message || `User must have one of these roles: ${roleList}`);
  }
}

/**
 * Assert that a user is admin (throws error if not)
 */
export function assertAdmin(user, message) {
  if (!isAdmin(user)) {
    throw new Error(message || 'User must be an administrator');
  }
}

/**
 * Assert that a user is superuser (throws error if not)
 */
export function assertSuperuser(user, message) {
  if (!isSuperuser(user)) {
    throw new Error(message || 'User must be a superuser');
  }
}
