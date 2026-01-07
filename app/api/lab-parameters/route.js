import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canManageInventory } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/lab-parameters
 * Get all lab parameters
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canManageInventory,
    'You do not have permission to view lab parameters'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');

    const where = {};
    if (category) where.testCategory = category;
    if (isActive !== null) where.isActive = isActive === 'true';

    const parameters = await prisma.labParameter.findMany({
      where,
      orderBy: [
        { testCategory: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      parameters,
    });
  } catch (error) {
    console.error('Error fetching lab parameters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab parameters' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lab-parameters
 * Create a new lab parameter
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canManageInventory,
    'You do not have permission to manage lab parameters'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const {
      code,
      name,
      testCategory,
      unit,
      referenceRangeMin,
      referenceRangeMax,
      referenceText,
      method,
      sortOrder,
    } = body;

    // Validate required fields
    if (!code || !name || !testCategory) {
      return NextResponse.json(
        { error: 'Code, name, and test category are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await prisma.labParameter.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A lab parameter with this code already exists' },
        { status: 409 }
      );
    }

    const parameter = await prisma.labParameter.create({
      data: {
        code,
        name,
        testCategory,
        unit: unit || null,
        referenceRangeMin: referenceRangeMin ? parseFloat(referenceRangeMin) : null,
        referenceRangeMax: referenceRangeMax ? parseFloat(referenceRangeMax) : null,
        referenceText: referenceText || null,
        method: method || null,
        sortOrder: sortOrder ? parseInt(sortOrder) : null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        parameter,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating lab parameter:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create lab parameter' },
      { status: 500 }
    );
  }
}
