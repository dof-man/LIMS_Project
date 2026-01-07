import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/samples/pending
 * Get list of test requests with pending sample collections
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access sample collection queue'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Find test requests with items that require samples but aren't collected yet
    const testRequestItems = await prisma.testRequestItem.findMany({
      where: {
        status: 'pending',
        orderItem: {
          inventoryItem: {
            requiresSample: true,
          },
        },
        testRequest: {
          ...(priority && { priority }),
          ...(search && {
            OR: [
              { requestNumber: { contains: search, mode: 'insensitive' } },
              { patient: { 
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { patientNumber: { contains: search, mode: 'insensitive' } },
                ]
              }},
            ],
          }),
        },
      },
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
        orderItem: {
          include: {
            inventoryItem: {
              select: {
                itemCode: true,
                itemName: true,
                sampleType: true,
                requiresSample: true,
              },
            },
          },
        },
      },
      orderBy: [
        { testRequest: { priority: 'desc' } },
        { testRequest: { requestDate: 'asc' } },
      ],
      skip,
      take: limit,
    });

    // Group by test request
    const testRequestsMap = new Map();
    testRequestItems.forEach(item => {
      const trId = item.testRequest.id;
      if (!testRequestsMap.has(trId)) {
        testRequestsMap.set(trId, {
          testRequest: item.testRequest,
          pendingItems: [],
        });
      }
      testRequestsMap.get(trId).pendingItems.push({
        id: item.id,
        inventoryItem: item.orderItem.inventoryItem,
        status: item.status,
      });
    });

    const pendingTestRequests = Array.from(testRequestsMap.values());

    // Get total count for pagination
    const totalItems = await prisma.testRequestItem.count({
      where: {
        status: 'pending',
        orderItem: {
          inventoryItem: {
            requiresSample: true,
          },
        },
        testRequest: {
          ...(priority && { priority }),
          ...(search && {
            OR: [
              { requestNumber: { contains: search, mode: 'insensitive' } },
              { patient: { 
                OR: [
                  { firstName: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { patientNumber: { contains: search, mode: 'insensitive' } },
                ]
              }},
            ],
          }),
        },
      },
    });

    return NextResponse.json({
      success: true,
      pendingTestRequests,
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pending samples:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending samples' },
      { status: 500 }
    );
  }
}
