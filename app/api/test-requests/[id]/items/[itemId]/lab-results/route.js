import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * POST /api/test-requests/:id/items/:itemId/lab-results
 * Create or update lab result for a test request item
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can enter lab results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id, itemId } = params;
    const body = await request.json();
    const { resultValues, notes, sampleId, status } = body;

    // Validate required fields
    if (!resultValues || !Array.isArray(resultValues) || resultValues.length === 0) {
      return NextResponse.json(
        { error: 'Result values are required' },
        { status: 400 }
      );
    }

    // Get test request item
    const testRequestItem = await prisma.testRequestItem.findUnique({
      where: { id: itemId },
      include: {
        testRequest: {
          select: {
            id: true,
            requestNumber: true,
            patientId: true,
          },
        },
        orderItem: {
          include: {
            inventoryItem: {
              select: {
                itemName: true,
              },
            },
          },
        },
      },
    });

    if (!testRequestItem) {
      return NextResponse.json(
        { error: 'Test request item not found' },
        { status: 404 }
      );
    }

    if (testRequestItem.testRequestId !== id) {
      return NextResponse.json(
        { error: 'Test request item does not belong to this test request' },
        { status: 400 }
      );
    }

    // Validate all lab parameters exist
    const parameterIds = resultValues.map(v => v.labParameterId);
    const parameters = await prisma.labParameter.findMany({
      where: {
        id: { in: parameterIds },
      },
    });

    if (parameters.length !== parameterIds.length) {
      return NextResponse.json(
        { error: 'One or more lab parameters not found' },
        { status: 400 }
      );
    }

    // Create parameter map for validation
    const parameterMap = new Map(parameters.map(p => [p.id, p]));

    // Validate and process result values
    const processedValues = resultValues.map(rv => {
      const parameter = parameterMap.get(rv.labParameterId);
      const numericValue = rv.numericValue !== null && rv.numericValue !== undefined 
        ? parseFloat(rv.numericValue) 
        : null;

      // Determine if value is abnormal based on reference ranges
      let isAbnormal = false;
      let flag = null;

      if (numericValue !== null && !isNaN(numericValue)) {
        if (parameter.referenceRangeMin !== null && numericValue < parameter.referenceRangeMin) {
          isAbnormal = true;
          flag = numericValue < (parameter.referenceRangeMin * 0.5) ? 'LL' : 'L';
        } else if (parameter.referenceRangeMax !== null && numericValue > parameter.referenceRangeMax) {
          isAbnormal = true;
          flag = numericValue > (parameter.referenceRangeMax * 2) ? 'HH' : 'H';
        }
      }

      return {
        labParameterId: rv.labParameterId,
        value: rv.value || null,
        numericValue,
        textValue: rv.textValue || null,
        isAbnormal,
        flag,
      };
    });

    const testedBy = `${authResult.user.firstName || ''} ${authResult.user.lastName || ''}`.trim() 
      || authResult.user.username;

    // Check if result already exists
    const existingResult = await prisma.labResult.findFirst({
      where: {
        testRequestItemId: itemId,
      },
    });

    // Prevent editing validated results
    if (existingResult && existingResult.status === 'validated') {
      return NextResponse.json(
        { error: 'Cannot modify validated results. This result has been validated and is read-only.' },
        { status: 403 }
      );
    }

    let labResult;

    if (existingResult) {
      // Update existing result
      labResult = await prisma.$transaction(async (tx) => {
        // Delete existing values
        await tx.labResultValue.deleteMany({
          where: {
            labResultId: existingResult.id,
          },
        });

        // Update result
        const updated = await tx.labResult.update({
          where: { id: existingResult.id },
          data: {
            status: status || 'completed',
            testedDate: new Date(),
            testedBy,
            notes: notes || null,
            ...(sampleId && { sampleId }),
          },
        });

        // Create new values
        await tx.labResultValue.createMany({
          data: processedValues.map(pv => ({
            labResultId: updated.id,
            ...pv,
          })),
        });

        // Update test request item status
        await tx.testRequestItem.update({
          where: { id: itemId },
          data: {
            status: 'completed',
          },
        });

        return updated;
      });
    } else {
      // Create new result
      labResult = await prisma.$transaction(async (tx) => {
        const newResult = await tx.labResult.create({
          data: {
            testRequestId: testRequestItem.testRequestId,
            testRequestItemId: itemId,
            sampleId: sampleId || null,
            resultType: 'structured',
            status: status || 'completed',
            testedDate: new Date(),
            testedBy,
            notes: notes || null,
          },
        });

        // Create result values
        await tx.labResultValue.createMany({
          data: processedValues.map(pv => ({
            labResultId: newResult.id,
            ...pv,
          })),
        });

        // Update test request item status
        await tx.testRequestItem.update({
          where: { id: itemId },
          data: {
            status: 'completed',
          },
        });

        return newResult;
      });
    }

    // Fetch complete result with values
    const completeResult = await prisma.labResult.findUnique({
      where: { id: labResult.id },
      include: {
        labResultValues: {
          include: {
            labParameter: true,
          },
          orderBy: {
            labParameter: {
              sortOrder: 'asc',
            },
          },
        },
      },
    });

    // Check if all items in test request are completed
    const allItems = await prisma.testRequestItem.findMany({
      where: {
        testRequestId: testRequestItem.testRequestId,
      },
    });

    const allCompleted = allItems.every(item => item.status === 'completed');

    if (allCompleted) {
      await prisma.testRequest.update({
        where: { id: testRequestItem.testRequestId },
        data: {
          status: 'completed',
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Lab results saved successfully',
      labResult: completeResult,
      testedBy,
      testedDate: labResult.testedDate,
    }, { status: existingResult ? 200 : 201 });
  } catch (error) {
    console.error('Error saving lab results:', error);
    return NextResponse.json(
      { error: 'Failed to save lab results' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-requests/:id/items/:itemId/lab-results
 * Get lab result for a test request item
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access lab results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { itemId } = params;

    const labResult = await prisma.labResult.findFirst({
      where: {
        testRequestItemId: itemId,
      },
      include: {
        testRequest: {
          select: {
            id: true,
            requestNumber: true,
          },
        },
        testRequestItem: {
          include: {
            orderItem: {
              include: {
                inventoryItem: {
                  select: {
                    itemCode: true,
                    itemName: true,
                  },
                },
              },
            },
          },
        },
        labResultValues: {
          include: {
            labParameter: true,
          },
          orderBy: {
            labParameter: {
              sortOrder: 'asc',
            },
          },
        },
        sample: {
          select: {
            id: true,
            sampleNumber: true,
            sampleType: true,
            collectionDate: true,
          },
        },
      },
    });

    if (!labResult) {
      return NextResponse.json(
        { error: 'Lab result not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      labResult,
    });
  } catch (error) {
    console.error('Error fetching lab result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab result' },
      { status: 500 }
    );
  }
}
