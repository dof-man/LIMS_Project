import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/orders/[id]/payment-summary
 * Get payment summary for an order
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to view payment summary'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId } = await params;

    // Fetch order with payments
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch patient separately if customerType is patient
    let patient = null;
    if (order.customerType === 'patient' && order.customerId) {
      patient = await prisma.patient.findUnique({
        where: { id: order.customerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientNumber: true,
        },
      });
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Calculate payment summary
    const orderTotal = Number(order.totalAmount);
    
    const paymentsByStatus = {
      completed: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
    };

    const paymentHistory = order.payments.map((payment) => {
      const amount = Number(payment.amount);
      
      // Track by status
      if (payment.status === 'COMPLETED') {
        paymentsByStatus.completed += amount;
      } else if (payment.status === 'PENDING') {
        paymentsByStatus.pending += amount;
      } else if (payment.status === 'FAILED') {
        paymentsByStatus.failed += amount;
      } else if (payment.status === 'REFUNDED') {
        paymentsByStatus.refunded += amount;
      }

      return {
        id: payment.id,
        amount,
        method: payment.paymentMethod,
        status: payment.status,
        reference: payment.reference,
        notes: payment.notes,
        paidAt: payment.paymentDate,
        createdAt: payment.createdAt,
      };
    });

    // Calculate totals (count COMPLETED and PENDING as paid)
    const totalPaid = paymentsByStatus.completed + paymentsByStatus.pending;
    const totalRefunded = paymentsByStatus.refunded;
    const netPaid = totalPaid - totalRefunded;
    const balance = orderTotal - netPaid;
    const isFullyPaid = balance === 0;
    const isOverpaid = balance < 0;
    const isPartiallyPaid = netPaid > 0 && netPaid < orderTotal;

    const summary = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      orderTotal,
      
      // Payment totals
      totalPaid,
      totalPending: paymentsByStatus.pending,
      totalCompleted: paymentsByStatus.completed,
      totalRefunded,
      netPaid,
      balance,
      
      // Payment status
      isFullyPaid,
      isPartiallyPaid,
      isOverpaid,
      
      // Payment counts
      totalPayments: order.payments.length,
      completedPayments: order.payments.filter(p => p.status === 'COMPLETED').length,
      pendingPayments: order.payments.filter(p => p.status === 'PENDING').length,
      failedPayments: order.payments.filter(p => p.status === 'FAILED').length,
      refundedPayments: order.payments.filter(p => p.status === 'REFUNDED').length,
      
      // Payment breakdown by method
      paymentsByMethod: order.payments.reduce((acc, payment) => {
        if (!acc[payment.paymentMethod]) {
          acc[payment.paymentMethod] = {
            count: 0,
            total: 0,
          };
        }
        acc[payment.paymentMethod].count++;
        acc[payment.paymentMethod].total += Number(payment.amount);
        return acc;
      }, {}),
      
      // Payment history
      payments: paymentHistory,
      
      // Patient info
      patient,
    };

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment summary' },
      { status: 500 }
    );
  }
}
