import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canValidateResults } from '@/lib/rbac';

/**
 * @route POST /api/lab-results/:id/validate
 * @description Validate a lab result (SUPERUSER only)
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
    const labResultId = parseInt(id);

    if (isNaN(labResultId)) {
      return NextResponse.json(
        { error: 'Invalid lab result ID' },
        { status: 400 }
      );
    }

    // Get existing lab result
    const existingResult = await prisma.labResult.findUnique({
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
        }
      }
    });

    if (!existingResult) {
      return NextResponse.json(
        { error: 'Lab result not found' },
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

    // Check if result is completed (has values)
    if (existingResult.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed results can be validated' },
        { status: 400 }
      );
    }

    // Update lab result to validated status
    const validatedResult = await prisma.labResult.update({
      where: { id: labResultId },
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
        },
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

    return NextResponse.json({
      message: 'Lab result validated successfully',
      result: validatedResult
    });

  } catch (error) {
    console.error('Validate lab result error:', error);
    return NextResponse.json(
      { error: 'Failed to validate lab result', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * @route GET /api/lab-results/:id/validate
 * @description Get validation status of a lab result
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
    const labResultId = parseInt(id);

    if (isNaN(labResultId)) {
      return NextResponse.json(
        { error: 'Invalid lab result ID' },
        { status: 400 }
      );
    }

    const result = await prisma.labResult.findUnique({
      where: { id: labResultId },
      select: {
        id: true,
        status: true,
        validatedBy: true,
        validatedDate: true,
        testedBy: true,
        testedDate: true
      }
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      isValidated: result.status === 'validated',
      validationInfo: {
        status: result.status,
        validatedBy: result.validatedBy,
        validatedDate: result.validatedDate,
        testedBy: result.testedBy,
        testedDate: result.testedDate
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
