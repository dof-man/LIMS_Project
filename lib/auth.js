import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import prisma from './prisma.js';

const SALT_ROUNDS = 10;
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Hash a password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a unique session token
 */
export function generateSessionToken() {
  return uuidv4();
}

/**
 * Create a new session for a user
 */
export async function createSession(userId) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION);

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
    },
  });

  return session;
}

/**
 * Get session by token
 */
export async function getSessionByToken(token) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
    },
  });

  // Check if session exists and is not expired
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      // Delete expired session
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token) {
  try {
    await prisma.session.delete({
      where: { token },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete all expired sessions (cleanup)
 */
export async function deleteExpiredSessions() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

/**
 * Update user's last login time
 */
export async function updateLastLogin(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Authenticate user with username/email and password
 */
export async function authenticateUser(usernameOrEmail, password) {
  // Find user by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
      ],
    },
  });

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  if (!user.isActive) {
    return { success: false, error: 'Account is inactive' };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Update last login
  await updateLastLogin(user.id);

  // Create session
  const session = await createSession(user.id);

  return {
    success: true,
    session,
    user: session.user,
  };
}
