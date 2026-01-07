import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';

/**
 * @route GET /api/investigation-results/:id/print
 * @description Get investigation result data for printing
 * @access Authenticated users with lab results permission
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can view investigation results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const { id } = params;
    const investigationResultId = parseInt(id);

    if (isNaN(investigationResultId)) {
      return NextResponse.json(
        { error: 'Invalid investigation result ID' },
        { status: 400 }
      );
    }

    const result = await prisma.investigationResult.findUnique({
      where: { id: investigationResultId },
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
        sample: true
      }
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Investigation result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      result
    });

  } catch (error) {
    console.error('Get investigation result for print error:', error);
    return NextResponse.json(
      { error: 'Failed to get investigation result', details: error.message },
      { status: 500 }
    );
  }
}
