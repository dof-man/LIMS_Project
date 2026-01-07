#!/usr/bin/env node

/**
 * Create Initial Superuser
 * 
 * This script creates the first SUPERUSER account for the system.
 * Run this once after setting up the database.
 */

import 'dotenv/config';
import { hashPassword } from '../lib/auth.js';
import prisma from '../lib/prisma.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createSuperuser() {
  console.log('===========================================');
  console.log('   LIMS - Create Initial Superuser');
  console.log('===========================================\n');

  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      console.log('⚠️  Warning: Users already exist in the database.');
      const proceed = await question('Do you want to create another superuser? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        rl.close();
        await prisma.$disconnect();
        return;
      }
    }

    console.log('Please enter the superuser details:\n');

    const username = await question('Username: ');
    if (!username) {
      console.error('❌ Username is required');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    const email = await question('Email: ');
    if (!email) {
      console.error('❌ Email is required');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    const password = await question('Password: ');
    if (!password) {
      console.error('❌ Password is required');
      rl.close();
      await prisma.$disconnect();
      return;
    }

    const firstName = await question('First Name (optional): ');
    const lastName = await question('Last Name (optional): ');

    rl.close();

    console.log('\n🔄 Creating superuser...\n');

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
      return;
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
  } finally {
    await prisma.$disconnect();
  }
}

createSuperuser();
