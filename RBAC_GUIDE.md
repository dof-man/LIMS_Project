# Role-Based Access Control (RBAC) Guide

This guide explains how to use the RBAC utilities in the LIMS application.

## Table of Contents

- [Overview](#overview)
- [Role Hierarchy](#role-hierarchy)
- [Using RBAC in API Routes](#using-rbac-in-api-routes)
- [Using RBAC in Server Actions](#using-rbac-in-server-actions)
- [Using RBAC in Client Components](#using-rbac-in-client-components)
- [Available Permission Functions](#available-permission-functions)
- [Examples](#examples)

## Overview

The RBAC system provides a centralized way to check user permissions without hardcoding roles into business logic. All role checks should use the RBAC utilities from `lib/rbac.js`.

## Role Hierarchy

The system has four roles in ascending order of privilege:

1. **RECEPTION** - Front desk staff who register patients and handle billing
2. **LAB_STAFF** - Laboratory technicians who process samples and enter results
3. **ADMIN** - System administrators who manage users and settings
4. **SUPERUSER** - System owners with full access to all features

Higher roles inherit all permissions from lower roles.

## Using RBAC in API Routes

### Method 1: Using requirePermission Middleware

The `requirePermission` middleware is the recommended approach for API routes.

```javascript
import { requirePermission } from '@/lib/middleware';
import { canModifyPatients } from '@/lib/rbac';

export async function POST(request) {
  // Check permission using RBAC utility
  const authResult = await requirePermission(
    request,
    canModifyPatients,
    'Forbidden. You do not have permission to create patients.'
  );

  if (!authResult.authenticated) {
    return authResult.response;
  }

  if (!authResult.authorized) {
    return authResult.response;
  }

  // User has permission, proceed with operation
  const user = authResult.user;
  // ... your code here
}
```

### Method 2: Using Manual Permission Checks

For more complex permission logic, you can check permissions manually:

```javascript
import { requireAuth } from '@/lib/middleware';
import { canVerifyLabResults, hasAnyRole, Roles } from '@/lib/rbac';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authenticated) {
    return authResult.response;
  }

  const user = authResult.user;

  // Check specific permission
  if (!canVerifyLabResults(user)) {
    return NextResponse.json(
      { error: 'You do not have permission to verify lab results' },
      { status: 403 }
    );
  }

  // Or check for specific roles
  if (!hasAnyRole(user, [Roles.ADMIN, Roles.SUPERUSER])) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  // User has permission, proceed with operation
  // ... your code here
}
```

## Using RBAC in Server Actions

Server actions work similarly to API routes:

```javascript
'use server';

import { cookies } from 'next/headers';
import { getSessionByToken } from '@/lib/auth';
import { canModifyLabResults, assertLabStaff } from '@/lib/rbac';

export async function submitLabResult(data) {
  // Get session
  const token = cookies().get('session_token')?.value;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const session = await getSessionByToken(token);
  if (!session?.user) {
    throw new Error('Invalid session');
  }

  const user = session.user;

  // Method 1: Check permission and return error
  if (!canModifyLabResults(user)) {
    throw new Error('You do not have permission to modify lab results');
  }

  // Method 2: Use assertion (throws error if check fails)
  assertLabStaff(user); // Throws if user is not lab staff or higher

  // User has permission, proceed with operation
  // ... your code here
}
```

## Using RBAC in Client Components

For client-side UI rendering, fetch the user's session and check permissions:

```javascript
'use client';

import { useEffect, useState } from 'react';
import { canManageUsers, canModifyPatients, getRoleColor } from '@/lib/rbac';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fetch current user session
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.session?.user) {
          setUser(data.session.user);
        }
      });
  }, []);

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Role: <span className={getRoleColor(user.role)}>{user.role}</span></p>

      {/* Conditional rendering based on permissions */}
      {canManageUsers(user) && (
        <div>
          <h2>User Management</h2>
          <a href="/dashboard/users">Manage Users</a>
        </div>
      )}

      {canModifyPatients(user) && (
        <div>
          <h2>Patient Registration</h2>
          <a href="/dashboard/patients/new">Register New Patient</a>
        </div>
      )}
    </div>
  );
}
```

## Available Permission Functions

### Core Role Checking

```javascript
import { hasRole, hasAnyRole, hasAllRoles, hasMinimumRole } from '@/lib/rbac';

hasRole(user, 'ADMIN')                          // Check for exact role
hasAnyRole(user, ['ADMIN', 'SUPERUSER'])        // Check if user has any of the roles
hasAllRoles(user, ['LAB_STAFF', 'ADMIN'])       // Check if user has all roles (rarely used)
hasMinimumRole(user, 'LAB_STAFF')               // Check if user has LAB_STAFF or higher
```

### Convenience Functions

```javascript
import { isAdmin, isSuperuser, isLabStaff, isReception } from '@/lib/rbac';

isReception(user)      // RECEPTION only
isLabStaff(user)       // LAB_STAFF or higher
isAdmin(user)          // ADMIN or higher (ADMIN, SUPERUSER)
isSuperuser(user)      // SUPERUSER only
```

### User Management Permissions

```javascript
import { canManageUsers, canCreateRole, canModifyUser, canDeleteUser } from '@/lib/rbac';

canManageUsers(user)              // Can view and create users (ADMIN+)
canCreateRole(user, 'LAB_STAFF')  // Can create users with specific role
canModifyUser(user, targetUser)   // Can modify specific user
canDeleteUser(user, targetUser)   // Can delete specific user
```

### Clinical Permissions

```javascript
import {
  canAccessPatients,
  canModifyPatients,
  canAccessLabResults,
  canModifyLabResults,
  canVerifyLabResults,
  canReleaseLabResults
} from '@/lib/rbac';

canAccessPatients(user)      // View patient records (all roles)
canModifyPatients(user)      // Create/edit patients (RECEPTION+)
canAccessLabResults(user)    // View lab results (LAB_STAFF+)
canModifyLabResults(user)    // Enter lab results (LAB_STAFF+)
canVerifyLabResults(user)    // Verify results (ADMIN+)
canReleaseLabResults(user)   // Release results to patient (ADMIN+)
```

### Inventory & Billing Permissions

```javascript
import {
  canManageInventory,
  canViewInventory,
  canCreateOrders,
  canProcessPayments
} from '@/lib/rbac';

canViewInventory(user)       // View inventory (all roles)
canManageInventory(user)     // Manage inventory (ADMIN+)
canCreateOrders(user)        // Create orders (RECEPTION+)
canProcessPayments(user)     // Process payments (RECEPTION+)
```

### System Permissions

```javascript
import { canViewReports, canManageSettings } from '@/lib/rbac';

canViewReports(user)         // View reports (ADMIN+)
canManageSettings(user)      // Manage system settings (SUPERUSER only)
```

### Utility Functions

```javascript
import {
  getCreatableRoles,
  getAllRoles,
  isValidRole,
  getRoleDescription,
  getRoleColor,
  checkPermissions
} from '@/lib/rbac';

getCreatableRoles(user)           // Get roles user can create
getAllRoles()                     // Get all available roles
isValidRole('ADMIN')              // Validate role string
getRoleDescription('LAB_STAFF')   // Get role description
getRoleColor('ADMIN')             // Get Tailwind class for role
checkPermissions(user, ['canModifyPatients', 'canAccessLabResults'])
```

### Assertion Functions

Use these when you want to throw an error instead of returning boolean:

```javascript
import { assertRole, assertAnyRole, assertAdmin, assertSuperuser } from '@/lib/rbac';

assertRole(user, 'ADMIN')                    // Throws if not ADMIN
assertAnyRole(user, ['ADMIN', 'SUPERUSER'])  // Throws if not ADMIN or SUPERUSER
assertAdmin(user)                            // Throws if not ADMIN+
assertSuperuser(user)                        // Throws if not SUPERUSER
```

## Examples

### Example 1: Protected API Route with Multiple Checks

```javascript
import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canVerifyLabResults, canReleaseLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function POST(request) {
  // Check if user can verify results
  const authResult = await requirePermission(
    request,
    canVerifyLabResults,
    'You do not have permission to verify lab results'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  const { resultId, action } = await request.json();

  // Additional check for releasing results
  if (action === 'release' && !canReleaseLabResults(authResult.user)) {
    return NextResponse.json(
      { error: 'You do not have permission to release lab results' },
      { status: 403 }
    );
  }

  // Proceed with operation
  const result = await prisma.labResult.update({
    where: { id: resultId },
    data: {
      verifiedBy: authResult.user.id,
      verifiedAt: new Date(),
      status: action === 'release' ? 'RELEASED' : 'VERIFIED',
    },
  });

  return NextResponse.json({ success: true, result });
}
```

### Example 2: Complex User Management with Role Restrictions

```javascript
import { requirePermission } from '@/lib/middleware';
import { canManageUsers, canCreateRole, canModifyUser, Roles } from '@/lib/rbac';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canManageUsers,
    'You do not have permission to manage users'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  const userId = params.id;
  const { role, isActive } = await request.json();

  // Get the target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Check if current user can modify this specific user
  if (!canModifyUser(authResult.user, targetUser)) {
    return NextResponse.json(
      { error: 'You cannot modify this user' },
      { status: 403 }
    );
  }

  // Check if current user can assign the new role
  if (role && !canCreateRole(authResult.user, role)) {
    return NextResponse.json(
      { error: `You cannot assign role: ${role}` },
      { status: 403 }
    );
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role, isActive },
  });

  return NextResponse.json({ success: true, user: updatedUser });
}
```

### Example 3: Dashboard with Role-Based UI

```javascript
'use client';

import { useEffect, useState } from 'react';
import {
  canManageUsers,
  canModifyPatients,
  canModifyLabResults,
  canManageInventory,
  canProcessPayments,
  canViewReports,
  getRoleDescription,
  getRoleColor
} from '@/lib/rbac';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => setUser(data.session?.user));
  }, []);

  if (!user) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2">
          Role: <span className={getRoleColor(user.role)}>{user.role}</span>
          <span className="text-gray-600 ml-2">
            ({getRoleDescription(user.role)})
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {canModifyPatients(user) && (
          <DashboardCard
            title="Patient Registration"
            description="Register new patients"
            link="/dashboard/patients/new"
          />
        )}

        {canModifyLabResults(user) && (
          <DashboardCard
            title="Lab Results"
            description="Enter and manage lab results"
            link="/dashboard/lab-results"
          />
        )}

        {canManageInventory(user) && (
          <DashboardCard
            title="Inventory Management"
            description="Manage lab inventory"
            link="/dashboard/inventory"
          />
        )}

        {canProcessPayments(user) && (
          <DashboardCard
            title="Billing & Payments"
            description="Process patient payments"
            link="/dashboard/billing"
          />
        )}

        {canViewReports(user) && (
          <DashboardCard
            title="Reports"
            description="View system reports"
            link="/dashboard/reports"
          />
        )}

        {canManageUsers(user) && (
          <DashboardCard
            title="User Management"
            description="Manage system users"
            link="/dashboard/users"
          />
        )}
      </div>
    </div>
  );
}

function DashboardCard({ title, description, link }) {
  return (
    <a
      href={link}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition"
    >
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </a>
  );
}
```

## Best Practices

1. **Always use RBAC utilities** - Never hardcode role names in business logic
2. **Check permissions, not roles** - Use `canModifyPatients(user)` instead of `hasRole(user, 'RECEPTION')`
3. **Use requirePermission in API routes** - It provides consistent error handling
4. **Use assertions in server actions** - They throw errors that can be caught and handled
5. **Check permissions on both client and server** - Client-side for UI, server-side for security
6. **Import from RBAC module** - Always import from `@/lib/rbac` for consistency
7. **Use Roles constant** - Reference `Roles.ADMIN` instead of the string `'ADMIN'`

## Common Patterns

### Pattern 1: Simple Permission Check

```javascript
if (!canModifyPatients(user)) {
  return error('Permission denied');
}
```

### Pattern 2: Multiple Permission Options

```javascript
if (!canModifyLabResults(user) && !canVerifyLabResults(user)) {
  return error('You need lab access');
}
```

### Pattern 3: Dynamic Permission Based on Data

```javascript
const canEdit = targetUser.id === user.id || canModifyUser(user, targetUser);
```

### Pattern 4: Permission with Custom Logic

```javascript
const canApprove = canVerifyLabResults(user) && result.status === 'PENDING';
```

---

For more information about the authentication system, see [AUTHENTICATION.md](./AUTHENTICATION.md).
