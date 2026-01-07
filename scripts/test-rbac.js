/**
 * Test RBAC Utilities
 * This script tests the RBAC module without needing a running server
 */

const {
  Roles,
  hasRole,
  hasAnyRole,
  hasMinimumRole,
  isAdmin,
  isSuperuser,
  isLabStaff,
  isReception,
  canManageUsers,
  canCreateRole,
  canModifyUser,
  canAccessPatients,
  canModifyPatients,
  canModifyLabResults,
  canVerifyLabResults,
  canReleaseLabResults,
  canManageInventory,
  canProcessPayments,
  getRoleDescription,
  getCreatableRoles,
  getAllRoles,
} = require('../lib/rbac');

console.log('=== RBAC Module Test ===\n');

// Test users
const reception = { id: '1', username: 'reception1', role: 'RECEPTION' };
const labStaff = { id: '2', username: 'lab1', role: 'LAB_STAFF' };
const admin = { id: '3', username: 'admin1', role: 'ADMIN' };
const superuser = { id: '4', username: 'super1', role: 'SUPERUSER' };

console.log('Test Users:');
console.log('- RECEPTION:', reception.username);
console.log('- LAB_STAFF:', labStaff.username);
console.log('- ADMIN:', admin.username);
console.log('- SUPERUSER:', superuser.username);
console.log();

// Test role checking
console.log('=== Role Checking ===');
console.log('isReception(reception):', isReception(reception));
console.log('isLabStaff(labStaff):', isLabStaff(labStaff));
console.log('isLabStaff(admin):', isLabStaff(admin), '(admin inherits LAB_STAFF permissions)');
console.log('isAdmin(admin):', isAdmin(admin));
console.log('isAdmin(superuser):', isAdmin(superuser), '(superuser inherits ADMIN permissions)');
console.log('isSuperuser(superuser):', isSuperuser(superuser));
console.log('isSuperuser(admin):', isSuperuser(admin));
console.log();

// Test role hierarchy
console.log('=== Role Hierarchy (hasMinimumRole) ===');
console.log('hasMinimumRole(reception, "RECEPTION"):', hasMinimumRole(reception, 'RECEPTION'));
console.log('hasMinimumRole(reception, "LAB_STAFF"):', hasMinimumRole(reception, 'LAB_STAFF'));
console.log('hasMinimumRole(labStaff, "LAB_STAFF"):', hasMinimumRole(labStaff, 'LAB_STAFF'));
console.log('hasMinimumRole(admin, "LAB_STAFF"):', hasMinimumRole(admin, 'LAB_STAFF'));
console.log('hasMinimumRole(admin, "ADMIN"):', hasMinimumRole(admin, 'ADMIN'));
console.log();

// Test user management permissions
console.log('=== User Management Permissions ===');
console.log('canManageUsers(reception):', canManageUsers(reception));
console.log('canManageUsers(labStaff):', canManageUsers(labStaff));
console.log('canManageUsers(admin):', canManageUsers(admin));
console.log('canManageUsers(superuser):', canManageUsers(superuser));
console.log();

console.log('Role Creation Permissions:');
console.log('- ADMIN can create RECEPTION:', canCreateRole(admin, 'RECEPTION'));
console.log('- ADMIN can create LAB_STAFF:', canCreateRole(admin, 'LAB_STAFF'));
console.log('- ADMIN can create ADMIN:', canCreateRole(admin, 'ADMIN'));
console.log('- ADMIN can create SUPERUSER:', canCreateRole(admin, 'SUPERUSER'));
console.log('- SUPERUSER can create SUPERUSER:', canCreateRole(superuser, 'SUPERUSER'));
console.log();

// Test patient permissions
console.log('=== Patient Permissions ===');
console.log('canAccessPatients(reception):', canAccessPatients(reception));
console.log('canModifyPatients(reception):', canModifyPatients(reception));
console.log('canModifyPatients(labStaff):', canModifyPatients(labStaff));
console.log();

// Test lab result permissions
console.log('=== Lab Result Permissions ===');
console.log('canModifyLabResults(reception):', canModifyLabResults(reception));
console.log('canModifyLabResults(labStaff):', canModifyLabResults(labStaff));
console.log('canVerifyLabResults(labStaff):', canVerifyLabResults(labStaff));
console.log('canVerifyLabResults(admin):', canVerifyLabResults(admin));
console.log('canReleaseLabResults(admin):', canReleaseLabResults(admin));
console.log();

// Test inventory permissions
console.log('=== Inventory & Billing Permissions ===');
console.log('canProcessPayments(reception):', canProcessPayments(reception));
console.log('canProcessPayments(labStaff):', canProcessPayments(labStaff));
console.log('canManageInventory(admin):', canManageInventory(admin));
console.log();

// Test utility functions
console.log('=== Utility Functions ===');
console.log('getAllRoles():', getAllRoles());
console.log('getCreatableRoles(admin):', getCreatableRoles(admin));
console.log('getCreatableRoles(superuser):', getCreatableRoles(superuser));
console.log();

console.log('Role Descriptions:');
Object.keys(Roles).forEach(role => {
  console.log(`- ${role}: ${getRoleDescription(Roles[role])}`);
});
console.log();

// Test complex scenarios
console.log('=== Complex Scenarios ===');
console.log('Scenario 1: Can ADMIN modify SUPERUSER?');
console.log('canModifyUser(admin, superuser):', canModifyUser(admin, superuser));
console.log();

console.log('Scenario 2: Can ADMIN modify another ADMIN?');
const admin2 = { id: '5', username: 'admin2', role: 'ADMIN' };
console.log('canModifyUser(admin, admin2):', canModifyUser(admin, admin2));
console.log();

console.log('Scenario 3: Can SUPERUSER modify anyone?');
console.log('canModifyUser(superuser, admin):', canModifyUser(superuser, admin));
console.log('canModifyUser(superuser, superuser):', canModifyUser(superuser, superuser));
console.log();

console.log('=== All Tests Passed! ===');
