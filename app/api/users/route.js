import { NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { canManageUsers, canCreateRole } from '@/lib/rbac';

export async function POST(request) {
  // Check if user has permission to manage users
  const authResult = await requirePermission(
    request,
    canManageUsers,
    'Forbidden. You do not have permission to create users.'
  );
  if (!authResult.authenticated) {
    return authResult.response;
  }
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { username, email, password, role, firstName, lastName } = body;

    // Validate input
    if (!username || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Username, email, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['ADMIN', 'LAB_STAFF', 'RECEPTION', 'SUPERUSER'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: ADMIN, LAB_STAFF, RECEPTION, SUPERUSER' },
        { status: 400 }
      );
    }

    // Check if the current user can create users with the requested role
    if (!canCreateRole(authResult.user, role)) {
      return NextResponse.json(
        { error: `Forbidden. You cannot create users with role: ${role}` },
        { status: 403 }
      );
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username or email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role,
        firstName: firstName || null,
        lastName: lastName || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      user,
    }, { status: 201 });
  } catch (error) {
    console.error('User registration error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  // Check if user has permission to manage users
  const authResult = await requirePermission(
    request,
    canManageUsers,
    'Forbidden. You do not have permission to view users.'
  );
  if (!authResult.authenticated) {
    return authResult.response;
  }
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching users' },
      { status: 500 }
    );
  }
}
