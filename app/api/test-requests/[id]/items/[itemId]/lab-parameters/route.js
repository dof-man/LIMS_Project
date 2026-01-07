import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/test-requests/:id/items/:itemId/lab-parameters
 * Get lab parameters for a specific test request item
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access lab parameters'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id, itemId } = await params;

    // Get test request item with inventory item details
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
                id: true,
                itemCode: true,
                itemName: true,
                category: true,
                subCategory: true,
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

    // Get lab parameters based on category/subcategory
    const inventoryItem = testRequestItem.orderItem.inventoryItem;
    const categoryMap = {
      'lab_test': 'hematology,biochemistry,immunology,microbiology',
      'LAB_TEST': 'hematology,biochemistry,immunology,microbiology',
    };

    // Try to match by subcategory first, then by category
    let parameters = [];
    
    if (inventoryItem.subCategory) {
      parameters = await prisma.labParameter.findMany({
        where: {
          testCategory: {
            equals: inventoryItem.subCategory,
            mode: 'insensitive',
          },
          isActive: true,
        },
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
      });
    }

    // If no parameters found by subcategory, try general category
    if (parameters.length === 0) {
      const categories = categoryMap[inventoryItem.category]?.split(',') || [];
      if (categories.length > 0) {
        parameters = await prisma.labParameter.findMany({
          where: {
            testCategory: {
              in: categories,
            },
            isActive: true,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        });
      }
    }

    // Check if there's already a lab result for this item
    const existingResult = await prisma.labResult.findFirst({
      where: {
        testRequestItemId: itemId,
      },
      include: {
        labResultValues: {
          include: {
            labParameter: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      testRequestItem: {
        id: testRequestItem.id,
        testRequestId: testRequestItem.testRequestId,
        inventoryItem,
      },
      parameters,
      existingResult,
    });
  } catch (error) {
    console.error('Error fetching lab parameters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab parameters' },
      { status: 500 }
    );
  }
}
