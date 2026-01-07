#!/usr/bin/env node

/**
 * Create Initial Superuser (Non-interactive)
 * 
 * This script creates the first SUPERUSER account for the system.
 * Usage: node scripts/create-superuser-simple.js <username> <email> <password> [firstName] [lastName]
 * Example: node scripts/create-superuser-simple.js admin admin@lims.local admin123 Super User
 */

import 'dotenv/config';
import { hashPassword } from '../lib/auth.js';
import prisma from '../lib/prisma.js';

async function createSuperuser() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node scripts/create-superuser-simple.js <username> <email> <password> [firstName] [lastName]');
    console.error('Example: node scripts/create-superuser-simple.js admin admin@lims.local admin123 Super User');
    process.exit(1);
  }

  const [username, email, password, firstName, lastName] = args;

  console.log('===========================================');
  console.log('   LIMS - Create Initial Superuser');
  console.log('===========================================\n');

  try {
    console.log('🔄 Creating superuser...\n');

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
      console.error('❌ Username or email already exists');
      await prisma.$disconnect();
      process.exit(1);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create superuser
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'SUPERUSER',
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
        createdAt: true,
      },
    });

    console.log('✅ Superuser created successfully!\n');
    console.log('User Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ID:        ${user.id}`);
    console.log(`Username:  ${user.username}`);
    console.log(`Email:     ${user.email}`);
    console.log(`Role:      ${user.role}`);
    if (user.firstName || user.lastName) {
      console.log(`Name:      ${user.firstName || ''} ${user.lastName || ''}`);
    }
    console.log(`Created:   ${user.createdAt.toLocaleString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('You can now login at: http://localhost:3000/login\n');

  } catch (error) {
    console.error('\n❌ Error creating superuser:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperuser();
