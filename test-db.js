// Simple script to test database connection
import prisma from './lib/prisma.js';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('✓ Database connection successful!');
    
    // Try to query (this will fail if the database/table doesn't exist yet)
    const userCount = await prisma.user.count();
    console.log(`✓ User table exists. Current count: ${userCount}`);
    
  } catch (error) {
    console.error('✗ Database connection failed:');
    console.error(error.message);
    console.error('\nMake sure PostgreSQL is running and the database exists.');
    console.error('You may need to run: npx prisma migrate dev --name init');
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
