import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * POST /api/test-requests/:id/items/:itemId/investigation-results
 * Create or update investigation result (free-text) for a test request item
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can enter investigation results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id, itemId } = params;
    const body = await request.json();
    const { findings, impression, recommendations, notes, sampleId } = body;

    // Validate required fields
    if (!findings || findings.trim() === '') {
      return NextResponse.json(
        { error: 'Findings are required' },
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
        inventoryItem: {
          select: {
            id: true,
            name: true,
            code: true,
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

    // Check if result already exists
    const existingResult = await prisma.investigationResult.findFirst({
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

    const reportedBy = `${authResult.user.firstName || ''} ${authResult.user.lastName || ''}`.trim() 
      || authResult.user.username;

    let investigationResult;

    if (existingResult) {
      // Update existing result
      investigationResult = await prisma.$transaction(async (tx) => {
        const updated = await tx.investigationResult.update({
          where: { id: existingResult.id },
          data: {
            findings,
            impression: impression || null,
            recommendations: recommendations || null,
            notes: notes || null,
            reportedDate: new Date(),
            reportedBy,
            status: 'completed',
            ...(sampleId && { sampleId }),
          },
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
      investigationResult = await prisma.$transaction(async (tx) => {
        const newResult = await tx.investigationResult.create({
          data: {
            testRequestId: testRequestItem.testRequestId,
            testRequestItemId: itemId,
            sampleId: sampleId || null,
            findings,
            impression: impression || null,
            recommendations: recommendations || null,
            notes: notes || null,
            reportedDate: new Date(),
            reportedBy,
            status: 'completed',
          },
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

    // Check if all items in the test request are completed
    const allItems = await prisma.testRequestItem.findMany({
      where: {
        testRequestId: testRequestItem.testRequestId,
      },
      select: {
        status: true,
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
      message: existingResult ? 'Investigation result updated successfully' : 'Investigation result created successfully',
      result: investigationResult,
    });

  } catch (error) {
    console.error('Save investigation result error:', error);
    return NextResponse.json(
      { error: 'Failed to save investigation result', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-requests/:id/items/:itemId/investigation-results
 * Get investigation result for a test request item
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
    const { id, itemId } = params;

    // Get test request item
    const testRequestItem = await prisma.testRequestItem.findUnique({
      where: { id: itemId },
      include: {
        testRequest: {
          include: {
            patient: {
              select: {
                id: true,
                patientNumber: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true,
              },
            },
          },
        },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
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

    // Get existing result if any
    const existingResult = await prisma.investigationResult.findFirst({
      where: {
        testRequestItemId: itemId,
      },
    });

    return NextResponse.json({
      testRequestItem,
      existingResult,
    });

  } catch (error) {
    console.error('Get investigation result error:', error);
    return NextResponse.json(
      { error: 'Failed to get investigation result', details: error.message },
      { status: 500 }
    );
  }
}
