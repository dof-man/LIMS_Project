import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canModifyLabResults } from '@/lib/rbac';

/**
 * @route GET /api/investigation-results/pending
 * @description Get list of test request items ready for investigation result entry
 * @access LAB_STAFF, ADMIN, SUPERUSER
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canModifyLabResults,
    'Only LAB_STAFF can access investigation results'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause for test request items
    const where = {
      testRequest: {
        status: { not: 'cancelled' }
      },
      inventoryItem: {
        category: { in: ['radiology', 'pathology', 'other_investigations'] }
      }
    };

    // Filter by item status
    if (status !== 'all') {
      where.status = status;
    }

    // Add priority filter
    if (priority) {
      where.testRequest.priority = priority.toUpperCase();
    }

    // Add search filter
    if (search) {
      where.testRequest.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get test request items with related data
    const [items, total] = await Promise.all([
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
                  gender: true
                }
              }
            }
          },
          inventoryItem: {
            select: {
              id: true,
              name: true,
              code: true,
              category: true
            }
          },
          sample: {
            select: {
              id: true,
              sampleNumber: true,
              sampleType: true,
              collectionDate: true
            }
          },
          investigationResult: {
            select: {
              id: true,
              status: true,
              reportedBy: true,
              reportedDate: true
            }
          }
        },
        orderBy: [
          { testRequest: { priority: 'desc' } },
          { createdAt: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.testRequestItem.count({ where })
    ]);

    // Format items for frontend
    const formattedItems = items.map(item => {
      const patient = item.testRequest.patient;
      const age = patient.dateOfBirth 
        ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
        : null;

      return {
        id: item.id,
        requestNumber: item.testRequest.requestNumber,
        requestId: item.testRequest.id,
        patient: {
          id: patient.id,
          patientNumber: patient.patientNumber,
          name: `${patient.firstName} ${patient.lastName}`,
          age,
          gender: patient.gender
        },
        investigation: {
          id: item.inventoryItem.id,
          name: item.inventoryItem.itemName,
          code: item.inventoryItem.itemCode,
          category: item.inventoryItem.category
        },
        sample: item.sample ? {
          id: item.sample.id,
          sampleNumber: item.sample.sampleNumber,
          sampleType: item.sample.sampleType,
          collectionDate: item.sample.collectionDate
        } : null,
        priority: item.testRequest.priority,
        status: item.status,
        hasResult: !!item.investigationResult,
        result: item.investigationResult,
        createdAt: item.createdAt
      };
    });

    return NextResponse.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Investigation results pending error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending investigation results', details: error.message },
      { status: 500 }
    );
  }
}
