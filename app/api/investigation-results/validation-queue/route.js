import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/middleware';
import { canValidateResults } from '@/lib/rbac';

/**
 * @route GET /api/investigation-results/validation-queue
 * @description Get list of completed investigation results awaiting validation
 * @access SUPERUSER
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canValidateResults,
    'Only SUPERUSER can access validation queue'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'completed';
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      status: status === 'all' ? undefined : status,
      testRequestItem: {
        testRequest: {}
      }
    };

    // Add priority filter
    if (priority) {
      where.testRequestItem.testRequest.priority = priority.toUpperCase();
    }

    // Add search filter
    if (search) {
      where.testRequestItem.testRequest.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { patient: { patientNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get investigation results with related data
    const [results, total] = await Promise.all([
      prisma.investigationResult.findMany({
        where,
        include: {
          testRequestItem: {
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
              }
            }
          }
        },
        orderBy: [
          { testRequestItem: { testRequest: { priority: 'desc' } } },
          { createdAt: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.investigationResult.count({ where })
    ]);

    // Format results for frontend
    const formattedResults = results.map(result => {
      const testRequest = result.testRequestItem.testRequest;
      const patient = testRequest.patient;
      const age = patient.dateOfBirth 
        ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000))
        : null;

      return {
        id: result.id,
        requestNumber: testRequest.requestNumber,
        requestId: testRequest.id,
        testRequestItemId: result.testRequestItemId,
        patient: {
          id: patient.id,
          patientNumber: patient.patientNumber,
          name: `${patient.firstName} ${patient.lastName}`,
          age,
          gender: patient.gender
        },
        investigation: {
          id: result.testRequestItem.inventoryItem.id,
          name: result.testRequestItem.inventoryItem.itemName,
          code: result.testRequestItem.inventoryItem.itemCode,
          category: result.testRequestItem.inventoryItem.category
        },
        sample: result.testRequestItem.sample ? {
          id: result.testRequestItem.sample.id,
          sampleNumber: result.testRequestItem.sample.sampleNumber,
          sampleType: result.testRequestItem.sample.sampleType,
          collectionDate: result.testRequestItem.sample.collectionDate
        } : null,
        priority: testRequest.priority,
        status: result.status,
        reportedBy: result.reportedBy,
        reportedDate: result.reportedDate,
        createdAt: result.createdAt
      };
    });

    return NextResponse.json({
      results: formattedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Validation queue error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation queue', details: error.message },
      { status: 500 }
    );
  }
}
