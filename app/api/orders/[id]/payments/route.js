import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/orders/[id]/payments
 * List all payments for an order
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to view payments'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId } = await params;

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch all payments for the order
    const payments = await prisma.payment.findMany({
      where: { orderId },
      orderBy: { paymentDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders/[id]/payments
 * Create a new payment for an order
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to create payments'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { amount, method, reference, notes, paidAt } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount is required' },
        { status: 400 }
      );
    }

    if (!method) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    // Validate payment method
    const validMethods = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'MOBILE_MONEY', 'OTHER'];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is cancelled
    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Cannot add payment to cancelled order' },
        { status: 409 }
      );
    }

    // Calculate total paid so far
    const totalPaid = order.payments.reduce(
      (sum, payment) => {
        if (payment.status === 'COMPLETED' || payment.status === 'PENDING') {
          return sum + Number(payment.amount);
        }
        return sum;
      },
      0
    );

    // Check if payment would exceed order total
    const newTotalPaid = totalPaid + Number(amount);
    const orderTotal = Number(order.total);

    if (newTotalPaid > orderTotal) {
      return NextResponse.json(
        { 
          error: `Payment amount exceeds order balance. Order total: ${orderTotal}, Already paid: ${totalPaid}, Balance: ${orderTotal - totalPaid}`,
          orderTotal,
          totalPaid,
          balance: orderTotal - totalPaid,
        },
        { status: 400 }
      );
    }

    // Generate payment number
    const paymentCount = await prisma.payment.count();
    const paymentNumber = `PAY-${String(paymentCount + 1).padStart(6, '0')}`;

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orderId,
        paymentNumber,
        amount: Number(amount),
        paymentMethod: method,
        reference: reference || null,
        notes: notes || null,
        status: 'COMPLETED', // Default to COMPLETED unless specified
        paymentDate: paidAt ? new Date(paidAt) : new Date(),
      },
    });

    // Calculate new payment summary
    const updatedTotalPaid = totalPaid + Number(amount);
    const balance = orderTotal - updatedTotalPaid;
    const isFullyPaid = balance === 0;

    return NextResponse.json({
      success: true,
      payment,
      paymentSummary: {
        orderTotal,
        totalPaid: updatedTotalPaid,
        balance,
        isFullyPaid,
        paymentCount: order.payments.length + 1,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}
