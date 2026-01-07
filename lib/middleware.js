import { NextResponse } from 'next/server';
import { getSessionByToken } from '@/lib/auth';
import { hasAnyRole, hasRole, isAdmin, isSuperuser } from '@/lib/rbac';

/**
 * Get session from request cookies
 */
export async function getSession(request) {
  const token = request.cookies.get('session_token')?.value;
  if (!token) return null;

  return await getSessionByToken(token);
}

/**
 * Check if user is authenticated
 */
export async function requireAuth(request) {
  const session = await getSession(request);
  
  if (!session || !session.user) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      ),
    };
  }

  return {
    authenticated: true,
    session,
    user: session.user,
  };
}

/**
 * Check if user has specific role(s) using RBAC utilities
 */
export async function requireRole(request, allowedRoles) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authenticated) {
    return authResult;
  }

  // Use RBAC utility for role checking
  if (!hasAnyRole(authResult.user, allowedRoles)) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles.join(', ') : allowedRoles;
    return {
      authenticated: true,
      authorized: false,
      response: NextResponse.json(
        { error: `Forbidden. Required role(s): ${roles}` },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    authorized: true,
    session: authResult.session,
    user: authResult.user,
  };
}

/**
 * Helper to check if user is admin or superuser using RBAC utilities
 */
export async function requireAdmin(request) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authenticated) {
    return authResult;
  }

  // Use RBAC utility for admin checking
  if (!isAdmin(authResult.user)) {
    return {
      authenticated: true,
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden. Administrator access required.' },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    authorized: true,
    session: authResult.session,
    user: authResult.user,
  };
}

/**
 * Helper to check if user is superuser using RBAC utilities
 */
export async function requireSuperuser(request) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authenticated) {
    return authResult;
  }

  // Use RBAC utility for superuser checking
  if (!isSuperuser(authResult.user)) {
    return {
      authenticated: true,
      authorized: false,
      response: NextResponse.json(
        { error: 'Forbidden. Superuser access required.' },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    authorized: true,
    session: authResult.session,
    user: authResult.user,
  };
}

/**
 * Check if user passes a custom permission check function
 * This allows for flexible permission checking using any RBAC function
 */
export async function requirePermission(request, permissionCheckFn, errorMessage) {
  const authResult = await requireAuth(request);
  
  if (!authResult.authenticated) {
    return authResult;
  }

  // Execute the custom permission check function
  const hasPermission = permissionCheckFn(authResult.user);

  if (!hasPermission) {
    return {
      authenticated: true,
      authorized: false,
      response: NextResponse.json(
        { error: errorMessage || 'Forbidden. Insufficient permissions.' },
        { status: 403 }
      ),
    };
  }

  return {
    authenticated: true,
    authorized: true,
    session: authResult.session,
    user: authResult.user,
  };
}
