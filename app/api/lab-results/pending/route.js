import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/lab-results/pending
 * Get list of test request items ready for lab result entry
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access lab results queue'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'collected';
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where = {
      status: status === 'all' ? undefined : status,
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
    };

    const [testRequestItems, total] = await Promise.all([
      prisma.testRequestItem.findMany({
        where,
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
              samples: {
                select: {
                  id: true,
                  sampleNumber: true,
                  sampleType: true,
                  collectionDate: true,
                },
                orderBy: {
                  collectionDate: 'desc',
                },
                take: 1,
              },
            },
          },
          orderItem: {
            include: {
              inventoryItem: {
                select: {
                  itemCode: true,
                  itemName: true,
                  category: true,
                  subCategory: true,
                },
              },
            },
          },
          labResults: {
            select: {
              id: true,
              status: true,
              testedDate: true,
              testedBy: true,
            },
            orderBy: {
              testedDate: 'desc',
            },
            take: 1,
          },
        },
        orderBy: [
          { testRequest: { priority: 'desc' } },
          { testRequest: { requestDate: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      prisma.testRequestItem.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      testRequestItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pending lab results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending lab results' },
      { status: 500 }
    );
  }
}
