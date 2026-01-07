import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canAccessPatients } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/test-requests/[id]
 * Get single test request with full details
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to view test requests'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const testRequest = await prisma.testRequest.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            patientNumber: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
            allergies: true,
          },
        },
        testRequestItems: {
          include: {
            orderItem: {
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    itemName: true,
                    itemCode: true,
                    category: true,
                    description: true,
                    unitPrice: true,
                  },
                },
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        labResults: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!testRequest) {
      return NextResponse.json(
        { error: 'Test request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      testRequest,
    });
  } catch (error) {
    console.error('Error fetching test request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test request' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/test-requests/[id]
 * Update test request status or details
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to update test requests'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, urgency, sampleCollectedAt } = body;

    // Check if test request exists
    const existingRequest = await prisma.testRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Test request not found' },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate urgency if provided
    if (urgency) {
      const validUrgencies = ['ROUTINE', 'URGENT', 'STAT'];
      if (!validUrgencies.includes(urgency)) {
        return NextResponse.json(
          { error: `Invalid urgency. Must be one of: ${validUrgencies.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Update test request
    const updatedRequest = await prisma.testRequest.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(urgency !== undefined && { urgency }),
        ...(sampleCollectedAt !== undefined && { sampleCollectedAt: sampleCollectedAt ? new Date(sampleCollectedAt) : null }),
      },
      include: {
        patient: {
          select: {
            patientNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        testRequestItems: {
          include: {
            orderItem: {
              include: {
                inventoryItem: {
                  select: {
                    itemName: true,
                    itemCode: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      testRequest: updatedRequest,
      message: 'Test request updated successfully',
    });
  } catch (error) {
    console.error('Error updating test request:', error);
    return NextResponse.json(
      { error: 'Failed to update test request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test-requests/[id]
 * Cancel/delete test request (only if PENDING)
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to delete test requests'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    // Check if test request exists
    const testRequest = await prisma.testRequest.findUnique({
      where: { id },
      include: {
        labResults: true,
      },
    });

    if (!testRequest) {
      return NextResponse.json(
        { error: 'Test request not found' },
        { status: 404 }
      );
    }

    // Only allow cancellation of PENDING requests or deletion if no results exist
    if (testRequest.status !== 'pending' && testRequest.labResults.length > 0) {
      return NextResponse.json(
        { error: 'Can only cancel pending test requests or those without results' },
        { status: 409 }
      );
    }

    // Update to CANCELLED instead of deleting (maintain audit trail)
    await prisma.testRequest.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Test request cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling test request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel test request' },
      { status: 500 }
    );
  }
}
