import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';

/**
 * @route GET /api/lab-results/:id/print
 * @description Get lab result data for printing
 * @access Authenticated users with lab results permission
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can view lab results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const { id } = params;
    const labResultId = parseInt(id);

    if (isNaN(labResultId)) {
      return NextResponse.json(
        { error: 'Invalid lab result ID' },
        { status: 400 }
      );
    }

    const result = await prisma.labResult.findUnique({
      where: { id: labResultId },
      include: {
        testRequestItem: {
          include: {
            testRequest: {
              include: {
                patient: true
              }
            },
            inventoryItem: true
          }
        },
        sample: true,
        resultValues: {
          include: {
            parameter: true
          },
          orderBy: {
            parameter: {
              displayOrder: 'asc'
            }
          }
        }
      }
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      result
    });

  } catch (error) {
    console.error('Get lab result for print error:', error);
    return NextResponse.json(
      { error: 'Failed to get lab result', details: error.message },
      { status: 500 }
    );
  }
}
