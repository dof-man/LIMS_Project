# Authentication System Documentation

## Overview

The LIMS application now includes a complete session-based authentication system with role-based access control.

## Features Implemented

✅ **User Model with Roles**
- SUPERUSER - Full system access
- ADMIN - Administrative access
- LAB_STAFF - Laboratory operations
- RECEPTION - Front desk operations

✅ **Session Management**
- Secure session tokens (UUID)
- 24-hour session duration
- HTTP-only cookies
- Automatic session cleanup

✅ **Authentication Endpoints**
- Login (`POST /api/auth/login`)
- Logout (`POST /api/auth/logout`)
- Session check (`GET /api/auth/session`)
- User registration (`POST /api/users` - Admin only)

✅ **Route Protection**
- Authentication middleware
- Role-based authorization
- Protected API routes
- Protected pages

## Database Schema

### User Model
```prisma
model User {
  id           String   @id @default(uuid())
  username     String   @unique
  email        String   @unique
  passwordHash String
  role         UserRole
  firstName    String?
  lastName     String?
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Session Model
```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### User Roles
```prisma
enum UserRole {
  ADMIN
  LAB_STAFF
  RECEPTION
  SUPERUSER
}
```

## API Endpoints

### Authentication

#### Login
**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@lims.local",
    "role": "SUPERUSER",
    "firstName": "Super",
    "lastName": "User"
  }
}
```

**Error Response (401):**
```json
{
  "error": "Invalid credentials"
}
```

---

#### Logout
**Endpoint:** `POST /api/auth/logout`

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### Check Session
**Endpoint:** `GET /api/auth/session`

**Success Response (200):**
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "username": "admin",
    "email": "admin@lims.local",
    "role": "SUPERUSER",
    "firstName": "Super",
    "lastName": "User"
  }
}
```

**Unauthenticated Response (401):**
```json
{
  "authenticated": false
}
```

---

### User Management (Admin Only)

#### Create User
**Endpoint:** `POST /api/users`

**Authorization:** ADMIN or SUPERUSER role required

**Request Body:**
```json
{
  "username": "labtech",
  "email": "labtech@lims.local",
  "password": "password123",
  "role": "LAB_STAFF",
  "firstName": "Lab",
  "lastName": "Technician"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "labtech",
    "email": "labtech@lims.local",
    "role": "LAB_STAFF",
    "firstName": "Lab",
    "lastName": "Technician",
    "isActive": true,
    "createdAt": "2026-01-04T10:30:00.000Z"
  }
}
```

**Notes:**
- Only SUPERUSER can create other SUPERUSER accounts
- ADMIN can create ADMIN, LAB_STAFF, and RECEPTION accounts

---

#### List Users
**Endpoint:** `GET /api/users`

**Authorization:** ADMIN or SUPERUSER role required

**Success Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "username": "admin",
      "email": "admin@lims.local",
      "role": "SUPERUSER",
      "firstName": "Super",
      "lastName": "User",
      "isActive": true,
      "lastLoginAt": "2026-01-04T10:30:00.000Z",
      "createdAt": "2026-01-04T10:00:00.000Z",
      "updatedAt": "2026-01-04T10:30:00.000Z"
    }
  ]
}
```

---

## Middleware Functions

### Authentication Middleware

Located in `lib/middleware.js`:

#### `requireAuth(request)`
Checks if user is authenticated.

**Usage:**
```javascript
import { requireAuth } from '@/lib/middleware';

export async function GET(request) {
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response; // 401 Unauthorized
  }
  
  const user = authResult.user;
  // ... proceed with authenticated request
}
```

---

#### `requireRole(request, allowedRoles)`
Checks if user has specific role(s).

**Usage:**
```javascript
import { requireRole } from '@/lib/middleware';

export async function POST(request) {
  const authResult = await requireRole(request, ['ADMIN', 'SUPERUSER']);
  if (!authResult.authorized) {
    return authResult.response; // 401 or 403
  }
  
  // ... proceed with authorized request
}
```

---

#### `requireAdmin(request)`
Helper to check if user is ADMIN or SUPERUSER.

**Usage:**
```javascript
import { requireAdmin } from '@/lib/middleware';

export async function POST(request) {
  const authResult = await requireAdmin(request);
  if (!authResult.authorized) {
    return authResult.response;
  }
  
  // ... admin-only logic
}
```

---

#### `requireSuperuser(request)`
Helper to check if user is SUPERUSER only.

**Usage:**
```javascript
import { requireSuperuser } from '@/lib/middleware';

export async function DELETE(request) {
  const authResult = await requireSuperuser(request);
  if (!authResult.authorized) {
    return authResult.response;
  }
  
  // ... superuser-only logic
}
```

---

## Authentication Utilities

Located in `lib/auth.js`:

### Password Management
```javascript
import { hashPassword, verifyPassword } from '@/lib/auth';

// Hash a password
const hash = await hashPassword('password123');

// Verify a password
const isValid = await verifyPassword('password123', hash);
```

### Session Management
```javascript
import { createSession, getSessionByToken, deleteSession } from '@/lib/auth';

// Create a session
const session = await createSession(userId);

// Get session by token
const session = await getSessionByToken(token);

// Delete session (logout)
await deleteSession(token);
```

### User Authentication
```javascript
import { authenticateUser } from '@/lib/auth';

const result = await authenticateUser('admin', 'password123');
if (result.success) {
  console.log('User:', result.user);
  console.log('Session:', result.session);
}
```

---

## Protected Route Example

Example of a protected API route for patients:

```javascript
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/middleware';
import prisma from '@/lib/prisma';

export async function GET(request) {
  // Require authentication
  const authResult = await requireAuth(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  // Fetch data
  const patients = await prisma.patient.findMany();
  return NextResponse.json({ patients });
}

export async function POST(request) {
  // Require RECEPTION, ADMIN, or SUPERUSER role
  const authResult = await requireRole(request, ['RECEPTION', 'ADMIN', 'SUPERUSER']);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Create patient
  const body = await request.json();
  const patient = await prisma.patient.create({ data: body });
  return NextResponse.json({ patient });
}
```

---

## Pages

### Login Page
**URL:** `/login`
- Username/email and password form
- Redirects to `/dashboard` on success
- Basic error handling

### Dashboard
**URL:** `/dashboard`
- Requires authentication
- Shows user information
- Role-based UI sections
- Admin functions visible to ADMIN/SUPERUSER

### User Management
**URL:** `/dashboard/users`
- Requires ADMIN or SUPERUSER role
- List all users
- Create new users
- View user details and last login

---

## Creating Users

### Create Initial Superuser

**Interactive Mode:**
```bash
npm run auth:create-superuser
```

**Non-Interactive Mode:**
```bash
node scripts/create-superuser-simple.js <username> <email> <password> [firstName] [lastName]
```

**Example:**
```bash
node scripts/create-superuser-simple.js admin admin@lims.local admin123 Super User
```

### Create Additional Users

1. Log in as SUPERUSER or ADMIN
2. Navigate to `/dashboard/users`
3. Click "Add User"
4. Fill in the form and select role
5. Submit

**Or via API:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_TOKEN" \
  -d '{
    "username": "reception",
    "email": "reception@lims.local",
    "password": "password123",
    "role": "RECEPTION",
    "firstName": "Front",
    "lastName": "Desk"
  }'
```

---

## Security Features

### Password Security
- Passwords hashed using bcrypt (10 salt rounds)
- Passwords never stored in plain text
- Password hashes never returned in API responses

### Session Security
- HTTP-only cookies (not accessible to JavaScript)
- Secure flag in production (HTTPS only)
- SameSite=lax to prevent CSRF
- 24-hour session expiration
- Automatic cleanup of expired sessions

### Authorization
- Role-based access control
- Middleware for easy route protection
- Granular permission checking
- Different response codes (401 vs 403)

---

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Insufficient permissions |
| 409 | Conflict | Username/email already exists |
| 500 | Server Error | Database error |

---

## Testing Authentication

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Session
```bash
curl http://localhost:3000/api/auth/session \
  -H "Cookie: session_token=YOUR_TOKEN"
```

### Test Protected Route
```bash
curl http://localhost:3000/api/patients \
  -H "Cookie: session_token=YOUR_TOKEN"
```

---

## Role Hierarchy

```
SUPERUSER (highest privilege)
  ├─ Can create all user types
  ├─ Full system access
  └─ Cannot be created by ADMIN

ADMIN
  ├─ Can create ADMIN, LAB_STAFF, RECEPTION
  ├─ Administrative functions
  └─ User management

LAB_STAFF
  ├─ Laboratory operations
  ├─ Test result entry
  └─ Sample management

RECEPTION (lowest privilege)
  ├─ Patient registration
  ├─ Order creation
  └─ Basic data entry
```

---

## Next Steps

The authentication system is now complete. Future enhancements could include:

1. **Permissions System** - Granular permissions beyond roles
2. **Password Reset** - Email-based password reset
3. **Two-Factor Authentication** - SMS or TOTP 2FA
4. **Audit Logging** - Track all authentication events
5. **Account Lockout** - Prevent brute force attacks
6. **Session Management UI** - View/revoke active sessions
7. **API Keys** - For programmatic access
8. **OAuth Integration** - Social login support

---

## Troubleshooting

### "Unauthorized" Error
- Check if session cookie is present
- Verify session hasn't expired (24 hours)
- Ensure user account is active

### "Forbidden" Error
- Check user role matches required role
- Verify user has necessary permissions

### Session Not Persisting
- Check cookie settings in browser
- Verify HTTPS in production
- Check for SameSite issues

### Can't Create Superuser
- Ensure database migrations are applied
- Check DATABASE_URL is correct
- Verify bcrypt is installed

---

**Authentication system is fully operational! 🔐**

Test credentials:
- Username: `admin`
- Password: `admin123`
- URL: http://localhost:3000/login
