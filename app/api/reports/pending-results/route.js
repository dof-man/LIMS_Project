import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canViewReports } from '@/lib/rbac';
import prisma from '@/lib/prisma';

// GET /api/reports/pending-results - Get pending lab results report
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canViewReports,
    'Only ADMIN and SUPERUSER can view reports'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // lab_test, radiology, pathology, other

    // Build where clause
    let whereClause = {
      testRequest: {
        samples: {
          some: {
            status: 'collected'
          }
        }
      }
    };

    // Add category filter if provided
    if (category) {
      whereClause.orderItem = {
        inventoryItem: {
          category
        }
      };
    }

    const testRequestItems = await prisma.testRequestItem.findMany({
      where: whereClause,
      include: {
        testRequest: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerId: true,
                customerType: true
              }
            },
            samples: {
              select: {
                id: true,
                sampleNumber: true,
                collectionDate: true,
                status: true
              }
            }
          }
        },
        orderItem: {
          include: {
            inventoryItem: true
          }
        },
        labResults: {
          select: {
            id: true,
            status: true,
            resultType: true
          }
        }
      },
      orderBy: {
        testRequest: {
          requestDate: 'asc'
        }
      }
    });

    // Fetch patients separately for test requests
    const testRequestIds = [...new Set(testRequestItems.map(item => item.testRequestId))];
    const testRequests = await prisma.testRequest.findMany({
      where: {
        id: { in: testRequestIds },
        order: {
          customerType: 'patient'
        }
      },
      select: {
        id: true,
        orderId: true
      }
    });

    const orderIds = [...new Set(testRequests.map(tr => tr.orderId))];
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        customerType: 'patient'
      },
      select: {
        id: true,
        customerId: true
      }
    });

    const patientIds = [...new Set(orders.map(o => o.customerId).filter(Boolean))];
    const patients = await prisma.patient.findMany({
      where: {
        id: { in: patientIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        patientNumber: true,
        dateOfBirth: true,
        gender: true,
        phone: true
      }
    });

    // Create lookup maps
    const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));
    const testRequestMap = Object.fromEntries(testRequests.map(tr => [tr.id, tr]));

    // Filter items that don't have results or have incomplete results
    const pendingItems = testRequestItems.filter(item => {
      const isLabTest = item.orderItem.inventoryItem.category === 'lab_test';
      const hasLabResult = item.labResults && item.labResults.length > 0;

      if (isLabTest) {
        // Lab tests need lab results with resultType 'structured' that are completed or verified
        return !hasLabResult || item.labResults.some(r => r.status === 'pending' || r.status === 'in_progress');
      } else {
        // Other investigations need lab results with resultType 'investigation' that are completed or verified
        return !hasLabResult || item.labResults.some(r => r.status === 'pending' || r.status === 'in_progress');
      }
    });

    // Format the report data
    const report = pendingItems.map(item => {
      // Get the first collected sample for this test request
      const sample = item.testRequest.samples.find(s => s.status === 'collected') || item.testRequest.samples[0];
      
      const daysPending = sample ? Math.floor(
        (new Date() - new Date(sample.collectionDate)) / (1000 * 60 * 60 * 24)
      ) : 0;

      // Get patient info through the relation chain
      const testRequest = testRequestMap[item.testRequestId];
      const order = testRequest ? orderMap[testRequest.orderId] : null;
      const patient = order ? patientMap[order.customerId] : null;

      // Calculate age from dateOfBirth
      const age = patient && patient.dateOfBirth 
        ? Math.floor((new Date() - new Date(patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
        : null;

      return {
        requestId: item.testRequest.requestNumber,
        requestDate: item.testRequest.requestDate,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'N/A',
        patientMrn: patient?.patientNumber || 'N/A',
        patientAge: age,
        patientGender: patient?.gender || 'N/A',
        testName: item.orderItem.inventoryItem.itemName,
        testCode: item.orderItem.inventoryItem.itemCode,
        category: item.orderItem.inventoryItem.category,
        priority: item.testRequest.priority,
        sampleId: sample?.sampleNumber || 'N/A',
        collectionDate: sample?.collectionDate || null,
        daysPending,
        status: 'pending'
      };
    });

    // Calculate summary statistics
    const summary = {
      totalPending: report.length,
      labTests: report.filter(r => r.category === 'lab_test').length,
      radiology: report.filter(r => r.category === 'radiology').length,
      pathology: report.filter(r => r.category === 'pathology').length,
      other: report.filter(r => !['lab_test', 'radiology', 'pathology'].includes(r.category)).length,
      urgent: report.filter(r => r.priority === 'urgent').length,
      overdue: report.filter(r => {
        const maxDays = r.priority === 'urgent' ? 1 : 3;
        return r.daysPending > maxDays;
      }).length
    };

    return NextResponse.json({
      report,
      summary
    });

  } catch (error) {
    console.error('Error generating pending results report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
