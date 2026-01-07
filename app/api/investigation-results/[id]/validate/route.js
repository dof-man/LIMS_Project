import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canValidateResults } from '@/lib/rbac';

/**
 * @route POST /api/investigation-results/:id/validate
 * @description Validate an investigation result (SUPERUSER only)
 * @access SUPERUSER
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canValidateResults,
    'Only SUPERUSER can validate results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const investigationResultId = parseInt(id);

    if (isNaN(investigationResultId)) {
      return NextResponse.json(
        { error: 'Invalid investigation result ID' },
        { status: 400 }
      );
    }

    // Get existing investigation result
    const existingResult = await prisma.investigationResult.findUnique({
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
        }
      }
    });

    if (!existingResult) {
      return NextResponse.json(
        { error: 'Investigation result not found' },
        { status: 404 }
      );
    }

    // Check if already validated
    if (existingResult.status === 'validated') {
      return NextResponse.json(
        { error: 'Result is already validated' },
        { status: 400 }
      );
    }

    // Check if result is completed
    if (existingResult.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed results can be validated' },
        { status: 400 }
      );
    }

    // Update investigation result to validated status
    const validatedResult = await prisma.investigationResult.update({
      where: { id: investigationResultId },
      data: {
        status: 'validated',
        validatedBy: `${authResult.user.firstName || ''} ${authResult.user.lastName || ''}`.trim() || authResult.user.username,
        validatedDate: new Date()
      },
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
        }
      }
    });

    return NextResponse.json({
      message: 'Investigation result validated successfully',
      result: validatedResult
    });

  } catch (error) {
    console.error('Validate investigation result error:', error);
    return NextResponse.json(
      { error: 'Failed to validate investigation result', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @route GET /api/investigation-results/:id/validate
 * @description Get validation status of an investigation result
 * @access Authenticated
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

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
      select: {
        id: true,
        status: true,
        validatedBy: true,
        validatedDate: true,
        reportedBy: true,
        reportedDate: true
      }
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Investigation result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      isValidated: result.status === 'validated',
      validationInfo: {
        status: result.status,
        validatedBy: result.validatedBy,
        validatedDate: result.validatedDate,
        reportedBy: result.reportedBy,
        reportedDate: result.reportedDate
      }
    });

  } catch (error) {
    console.error('Get validation status error:', error);
    return NextResponse.json(
      { error: 'Failed to get validation status', details: error.message },
      { status: 500 }
    );
  }
}
