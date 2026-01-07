import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canViewReports } from '@/lib/rbac';
import prisma from '@/lib/prisma';

// GET /api/reports/daily-tests - Get daily tests count report
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    let dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Get test requests grouped by date
    const testRequests = await prisma.testRequest.findMany({
      where: Object.keys(dateFilter).length > 0 ? {
        requestDate: dateFilter
      } : {},
      include: {
        testRequestItems: {
          include: {
            orderItem: {
              include: {
                inventoryItem: true
              }
            }
          }
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerId: true,
            customerType: true
          }
        }
      },
      orderBy: {
        requestDate: 'desc'
      }
    });

    // Get patient data for patient orders
    const patientOrderIds = testRequests
      .filter(tr => tr.order.customerType === 'patient' && tr.order.customerId)
      .map(tr => tr.order.id);
    
    const orders = await prisma.order.findMany({
      where: {
        id: { in: patientOrderIds }
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
        patientNumber: true
      }
    });

    const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));
    const orderMap = Object.fromEntries(orders.map(o => [o.id, o]));

    // Group by date and aggregate
    const dailyData = {};
    
    testRequests.forEach(request => {
      const date = new Date(request.requestDate).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalRequests: 0,
          totalTests: 0,
          urgentTests: 0,
          routineTests: 0,
          labTests: 0,
          radiologyTests: 0,
          pathologyTests: 0,
          otherTests: 0
        };
      }

      dailyData[date].totalRequests += 1;
      dailyData[date].totalTests += request.testRequestItems.length;

      request.testRequestItems.forEach(item => {
        // Count by priority
        if (request.priority === 'urgent') {
          dailyData[date].urgentTests += 1;
        } else {
          dailyData[date].routineTests += 1;
        }

        // Count by category
        const category = item.orderItem.inventoryItem.category;
        if (category === 'lab_test') {
          dailyData[date].labTests += 1;
        } else if (category === 'radiology') {
          dailyData[date].radiologyTests += 1;
        } else if (category === 'pathology') {
          dailyData[date].pathologyTests += 1;
        } else {
          dailyData[date].otherTests += 1;
        }
      });
    });

    // Convert to array and sort by date descending
    const report = Object.values(dailyData).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    // Calculate totals
    const totals = {
      totalRequests: report.reduce((sum, day) => sum + day.totalRequests, 0),
      totalTests: report.reduce((sum, day) => sum + day.totalTests, 0),
      urgentTests: report.reduce((sum, day) => sum + day.urgentTests, 0),
      routineTests: report.reduce((sum, day) => sum + day.routineTests, 0),
      labTests: report.reduce((sum, day) => sum + day.labTests, 0),
      radiologyTests: report.reduce((sum, day) => sum + day.radiologyTests, 0),
      pathologyTests: report.reduce((sum, day) => sum + day.pathologyTests, 0),
      otherTests: report.reduce((sum, day) => sum + day.otherTests, 0)
    };

    return NextResponse.json({
      report,
      totals,
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Now'
      }
    });

  } catch (error) {
    console.error('Error generating daily tests report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
