import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/test-requests/:id/sample-collection
 * Get sample collection status for a test request
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access sample collection'
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
                    itemCode: true,
                    itemName: true,
                    category: true,
                    requiresSample: true,
                    sampleType: true,
                  },
                },
              },
            },
          },
        },
        samples: {
          orderBy: {
            collectionDate: 'desc',
          },
        },
      },
    });

    if (!testRequest) {
      return NextResponse.json(
        { error: 'Test request not found' },
        { status: 404 }
      );
    }

    // Filter items that require samples
    const itemsRequiringSamples = testRequest.testRequestItems.filter(
      item => item.orderItem.inventoryItem.requiresSample
    );

    return NextResponse.json({
      success: true,
      testRequest: {
        id: testRequest.id,
        requestNumber: testRequest.requestNumber,
        status: testRequest.status,
        priority: testRequest.priority,
        patient: testRequest.patient,
      },
      itemsRequiringSamples,
      existingSamples: testRequest.samples,
      summary: {
        totalItems: testRequest.testRequestItems.length,
        itemsRequiringSamples: itemsRequiringSamples.length,
        samplesCollected: testRequest.samples.length,
      },
    });
  } catch (error) {
    console.error('Error fetching sample collection data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample collection data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test-requests/:id/sample-collection
 * Collect sample for a test request
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can collect samples'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      sampleType,
      volume,
      containerType,
      condition,
      storageLocation,
      notes,
      testRequestItemIds, // Array of test request item IDs this sample is for
    } = body;

    // Validate required fields
    if (!sampleType) {
      return NextResponse.json(
        { error: 'Sample type is required' },
        { status: 400 }
      );
    }

    if (!testRequestItemIds || testRequestItemIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one test request item must be selected' },
        { status: 400 }
      );
    }

    // Check if test request exists
    const testRequest = await prisma.testRequest.findUnique({
      where: { id },
      include: {
        patient: true,
        testRequestItems: {
          where: {
            id: { in: testRequestItemIds },
          },
          include: {
            orderItem: {
              include: {
                inventoryItem: true,
              },
            },
          },
        },
      },
    });

    if (!testRequest) {
      return NextResponse.json(
        { error: 'Test request not found' },
        { status: 404 }
      );
    }

    if (testRequest.testRequestItems.length !== testRequestItemIds.length) {
      return NextResponse.json(
        { error: 'One or more test request items not found' },
        { status: 404 }
      );
    }

    // Validate all items require samples
    const itemsNotRequiringSamples = testRequest.testRequestItems.filter(
      item => !item.orderItem.inventoryItem.requiresSample
    );

    if (itemsNotRequiringSamples.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some selected items do not require samples',
          items: itemsNotRequiringSamples.map(i => ({
            id: i.id,
            name: i.orderItem.inventoryItem.itemName,
          })),
        },
        { status: 400 }
      );
    }

    // Generate unique sample number
    const sampleNumber = await generateSampleNumber();

    const collectedBy = `${authResult.user.firstName || ''} ${authResult.user.lastName || ''}`.trim() 
      || authResult.user.username;

    // Create sample in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create sample
      const sample = await tx.sample.create({
        data: {
          sampleNumber,
          patientId: testRequest.patientId,
          testRequestId: testRequest.id,
          sampleType,
          collectionDate: new Date(),
          collectionTime: new Date(),
          collectedBy,
          volume: volume || null,
          containerType: containerType || null,
          status: 'collected',
          condition: condition || 'good',
          storageLocation: storageLocation || null,
          notes: notes || null,
        },
      });

      // Update test request items to 'collected' status
      await tx.testRequestItem.updateMany({
        where: {
          id: { in: testRequestItemIds },
        },
        data: {
          status: 'collected',
        },
      });

      // Check if all items in the test request are collected
      const allItems = await tx.testRequestItem.findMany({
        where: {
          testRequestId: testRequest.id,
        },
        include: {
          orderItem: {
            include: {
              inventoryItem: true,
            },
          },
        },
      });

      const itemsRequiringSamples = allItems.filter(
        item => item.orderItem.inventoryItem.requiresSample
      );

      const allCollected = itemsRequiringSamples.every(
        item => item.status === 'collected' || item.status === 'processing' || item.status === 'completed'
      );

      // Update test request status if all samples collected
      if (allCollected && testRequest.status === 'pending') {
        await tx.testRequest.update({
          where: { id: testRequest.id },
          data: {
            status: 'in_progress',
          },
        });
      }

      return sample;
    });

    return NextResponse.json({
      success: true,
      message: 'Sample collected successfully',
      sample: result,
      collectedBy,
      collectionTime: result.collectionDate,
    }, { status: 201 });
  } catch (error) {
    console.error('Error collecting sample:', error);
    return NextResponse.json(
      { error: 'Failed to collect sample' },
      { status: 500 }
    );
  }
}

/**
 * Generate unique Sample Number
 * Format: SAM-YYYYMMDD-XXXX
 */
async function generateSampleNumber() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  const lastSample = await prisma.sample.findFirst({
    where: {
      sampleNumber: {
        startsWith: `SAM-${datePrefix}`,
      },
    },
    orderBy: {
      sampleNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastSample) {
    const lastSequence = parseInt(lastSample.sampleNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `SAM-${datePrefix}-${String(sequence).padStart(4, '0')}`;
}
