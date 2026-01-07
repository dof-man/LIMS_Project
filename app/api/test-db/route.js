import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    
    // Get count of users (will be 0 if no users exist)
    const userCount = await prisma.user.count();
    
    return NextResponse.json({ 
      status: 'success',
      message: 'Database connection successful',
      userCount 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Database connection failed',
      error: error.message 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
