import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canViewReports } from '@/lib/rbac';
import prisma from '@/lib/prisma';

// GET /api/reports/payments-summary - Get payments summary report
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
    const paymentStatus = searchParams.get('status'); // paid, partial, unpaid
    const paymentMethod = searchParams.get('method'); // cash, card, mobile_money, insurance

    // Build filters
    let filters = {};
    
    if (startDate || endDate) {
      filters.paymentDate = {};
      if (startDate) {
        filters.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filters.paymentDate.lte = end;
      }
    }

    if (paymentStatus) {
      filters.paymentStatus = paymentStatus;
    }

    if (paymentMethod) {
      filters.paymentMethod = paymentMethod;
    }

    // Get payments with details
    const payments = await prisma.payment.findMany({
      where: filters,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerId: true,
            customerType: true,
            totalAmount: true,
            amountPaid: true,
            balance: true
          }
        }
      },
      orderBy: {
        paymentDate: 'desc'
      }
    });

    // Get unique patient IDs from orders
    const patientOrders = payments
      .filter(p => p.order.customerType === 'patient' && p.order.customerId)
      .map(p => ({ orderId: p.order.id, customerId: p.order.customerId }));
    
    const patientIds = [...new Set(patientOrders.map(o => o.customerId))];
    
    const patients = await prisma.patient.findMany({
      where: {
        id: { in: patientIds }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        patientNumber: true,
        phone: true
      }
    });

    const patientMap = Object.fromEntries(patients.map(p => [p.id, p]));

    // Format report data
    const report = payments.map(payment => {
      const patient = payment.order.customerType === 'patient' 
        ? patientMap[payment.order.customerId] 
        : null;
      
      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        orderNumber: payment.order.orderNumber,
        paymentDate: payment.paymentDate,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : payment.order.customerType,
        patientMrn: patient?.patientNumber || 'N/A',
        patientPhone: patient?.phone || 'N/A',
        totalAmount: parseFloat(payment.order.totalAmount),
        amountPaid: parseFloat(payment.order.amountPaid),
        balance: parseFloat(payment.order.balance),
        paymentAmount: parseFloat(payment.amount),
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        reference: payment.reference,
        receivedBy: payment.receivedBy
      };
    });

    // Calculate summary statistics
    const summary = {
      totalPayments: report.length,
      totalAmount: report.reduce((sum, p) => sum + p.paymentAmount, 0),
      totalBilled: report.reduce((sum, p) => sum + p.totalAmount, 0),
      totalCollected: report.reduce((sum, p) => sum + p.amountPaid, 0),
      totalOutstanding: report.reduce((sum, p) => sum + p.balance, 0),
      completedCount: report.filter(p => p.status === 'COMPLETED').length,
      pendingCount: report.filter(p => p.status === 'PENDING').length,
      failedCount: report.filter(p => p.status === 'FAILED').length,
      refundedCount: report.filter(p => p.status === 'REFUNDED').length,
      cashAmount: report.filter(p => p.paymentMethod === 'CASH').reduce((sum, p) => sum + p.paymentAmount, 0),
      cardAmount: report.filter(p => p.paymentMethod === 'CARD').reduce((sum, p) => sum + p.paymentAmount, 0),
      bankTransferAmount: report.filter(p => p.paymentMethod === 'BANK_TRANSFER').reduce((sum, p) => sum + p.paymentAmount, 0),
      mobileMoneyAmount: report.filter(p => p.paymentMethod === 'MOBILE_MONEY').reduce((sum, p) => sum + p.paymentAmount, 0)
    };

    return NextResponse.json({
      report,
      summary,
      filters: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Now',
        status: paymentStatus || 'All',
        method: paymentMethod || 'All'
      }
    });

  } catch (error) {
    console.error('Error generating payments summary report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
