import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canViewReports } from '@/lib/rbac';
import prisma from '@/lib/prisma';

// GET /api/reports/daily-revenue - Get daily revenue report
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

    // Get payments grouped by date
    const payments = await prisma.payment.findMany({
      where: Object.keys(dateFilter).length > 0 ? {
        paymentDate: dateFilter
      } : {},
      include: {
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
        paymentDate: 'desc'
      }
    });

    // Group by date and aggregate
    const dailyData = {};
    
    payments.forEach(payment => {
      const date = new Date(payment.paymentDate).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalPayments: 0,
          totalAmount: 0,
          cashAmount: 0,
          cardAmount: 0,
          bankTransferAmount: 0,
          mobileMoneyAmount: 0,
          completedCount: 0,
          pendingCount: 0,
          failedCount: 0
        };
      }

      dailyData[date].totalPayments += 1;
      dailyData[date].totalAmount += parseFloat(payment.amount);

      // Count by payment method
      if (payment.paymentMethod === 'CASH') {
        dailyData[date].cashAmount += parseFloat(payment.amount);
      } else if (payment.paymentMethod === 'CARD') {
        dailyData[date].cardAmount += parseFloat(payment.amount);
      } else if (payment.paymentMethod === 'BANK_TRANSFER') {
        dailyData[date].bankTransferAmount += parseFloat(payment.amount);
      } else if (payment.paymentMethod === 'MOBILE_MONEY') {
        dailyData[date].mobileMoneyAmount += parseFloat(payment.amount);
      }

      // Count by payment status
      if (payment.status === 'COMPLETED') {
        dailyData[date].completedCount += 1;
      } else if (payment.status === 'PENDING') {
        dailyData[date].pendingCount += 1;
      } else if (payment.status === 'FAILED') {
        dailyData[date].failedCount += 1;
      }
    });

    // Convert to array and sort by date descending
    const report = Object.values(dailyData).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    // Calculate totals
    const totals = {
      totalPayments: report.reduce((sum, day) => sum + day.totalPayments, 0),
      totalAmount: report.reduce((sum, day) => sum + day.totalAmount, 0),
      cashAmount: report.reduce((sum, day) => sum + day.cashAmount, 0),
      cardAmount: report.reduce((sum, day) => sum + day.cardAmount, 0),
      bankTransferAmount: report.reduce((sum, day) => sum + day.bankTransferAmount, 0),
      mobileMoneyAmount: report.reduce((sum, day) => sum + day.mobileMoneyAmount, 0),
      completedCount: report.reduce((sum, day) => sum + day.completedCount, 0),
      pendingCount: report.reduce((sum, day) => sum + day.pendingCount, 0),
      failedCount: report.reduce((sum, day) => sum + day.failedCount, 0)
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
    console.error('Error generating daily revenue report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
