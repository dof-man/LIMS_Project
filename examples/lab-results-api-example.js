/**
 * Example: Lab Results API with RBAC Integration
 * 
 * This example demonstrates how to use RBAC utilities for a complete
 * API route with different permission levels.
 */

import { NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/middleware';
import {
  canAccessLabResults,
  canModifyLabResults,
  canVerifyLabResults,
  canReleaseLabResults,
  isLabStaff,
  assertLabStaff
} from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/lab-results
 * View lab results (requires lab access)
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canAccessLabResults,
    'You do not have permission to view lab results'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const results = await prisma.labResult.findMany({
      where: status ? { status } : {},
      include: {
        sample: {
          include: {
            testRequest: {
              include: {
                patient: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    patientNumber: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error fetching lab results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab results' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lab-results
 * Create or update lab result (requires lab staff or higher)
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'You do not have permission to modify lab results'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { sampleId, values, comments, status } = await request.json();

    // Validate required fields
    if (!sampleId || !values) {
      return NextResponse.json(
        { error: 'Sample ID and values are required' },
        { status: 400 }
      );
    }

    // Check if sample exists
    const sample = await prisma.sample.findUnique({
      where: { id: sampleId },
    });

    if (!sample) {
      return NextResponse.json(
        { error: 'Sample not found' },
        { status: 404 }
      );
    }

    // Create or update lab result
    const result = await prisma.labResult.upsert({
      where: { sampleId },
      create: {
        sampleId,
        status: status || 'PENDING',
        performedBy: authResult.user.id,
        performedAt: new Date(),
        comments,
      },
      update: {
        status: status || 'PENDING',
        performedBy: authResult.user.id,
        performedAt: new Date(),
        comments,
      },
    });

    // Create lab result values
    const resultValues = await Promise.all(
      values.map((value) =>
        prisma.labResultValue.create({
          data: {
            labResultId: result.id,
            labParameterId: value.parameterId,
            value: value.value,
            unit: value.unit,
            referenceRange: value.referenceRange,
            isAbnormal: value.isAbnormal || false,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      result: {
        ...result,
        values: resultValues,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating lab result:', error);
    return NextResponse.json(
      { error: 'Failed to create lab result' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lab-results/[id]/verify
 * Verify lab result (requires admin or higher)
 */
export async function PATCH(request, { params }) {
  const authResult = await requirePermission(
    request,
    canVerifyLabResults,
    'You do not have permission to verify lab results'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const resultId = params.id;

    // Get the result
    const result = await prisma.labResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    // Verify result
    const verifiedResult = await prisma.labResult.update({
      where: { id: resultId },
      data: {
        status: 'VERIFIED',
        verifiedBy: authResult.user.id,
        verifiedAt: new Date(),
      },
      include: {
        values: true,
      },
    });

    return NextResponse.json({
      success: true,
      result: verifiedResult,
    });
  } catch (error) {
    console.error('Error verifying lab result:', error);
    return NextResponse.json(
      { error: 'Failed to verify lab result' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lab-results/[id]/release
 * Release lab result to patient (requires admin or higher)
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canReleaseLabResults,
    'You do not have permission to release lab results'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const resultId = params.id;

    // Get the result
    const result = await prisma.labResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    // Result must be verified before release
    if (result.status !== 'VERIFIED') {
      return NextResponse.json(
        { error: 'Lab result must be verified before release' },
        { status: 400 }
      );
    }

    // Release result
    const releasedResult = await prisma.labResult.update({
      where: { id: resultId },
      data: {
        status: 'RELEASED',
        releasedBy: authResult.user.id,
        releasedAt: new Date(),
      },
      include: {
        values: true,
        sample: {
          include: {
            testRequest: {
              include: {
                patient: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      result: releasedResult,
    });
  } catch (error) {
    console.error('Error releasing lab result:', error);
    return NextResponse.json(
      { error: 'Failed to release lab result' },
      { status: 500 }
    );
  }
}

/**
 * Example of using manual permission checks for complex logic
 */
export async function DELETE(request, { params }) {
  const authResult = await requireAuth(request);

  if (!authResult.authenticated) {
    return authResult.response;
  }

  const user = authResult.user;
  const resultId = params.id;

  try {
    // Get the result
    const result = await prisma.labResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    // Complex permission logic:
    // - Lab staff can delete their own pending results
    // - Admins can delete any pending or verified result
    // - Superusers can delete any result
    const canDelete = 
      (isLabStaff(user) && result.performedBy === user.id && result.status === 'PENDING') ||
      (canVerifyLabResults(user) && result.status !== 'RELEASED') ||
      (canReleaseLabResults(user)); // This checks for admin or higher

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this lab result' },
        { status: 403 }
      );
    }

    // Delete result
    await prisma.labResult.delete({
      where: { id: resultId },
    });

    return NextResponse.json({
      success: true,
      message: 'Lab result deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting lab result:', error);
    return NextResponse.json(
      { error: 'Failed to delete lab result' },
      { status: 500 }
    );
  }
}
