import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/orders/[id]/payments/[paymentId]
 * Get a single payment
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
    const { id: orderId, paymentId } = params;

    // Fetch payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify payment belongs to the order
    if (payment.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Payment does not belong to this order' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]/payments/[paymentId]
 * Update payment status or details
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to update payments'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId, paymentId } = params;
    const body = await request.json();
    const { status, notes, reference } = body;

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify payment belongs to the order
    if (existingPayment.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Payment does not belong to this order' },
        { status: 400 }
      );
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Update payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        ...(reference !== undefined && { reference }),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]/payments/[paymentId]
 * Delete a payment (only if status is PENDING or FAILED)
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to delete payments'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId, paymentId } = params;

    // Check if payment exists
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Verify payment belongs to the order
    if (existingPayment.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Payment does not belong to this order' },
        { status: 400 }
      );
    }

    // Only allow deletion of PENDING or FAILED payments
    if (existingPayment.status !== 'PENDING' && existingPayment.status !== 'FAILED') {
      return NextResponse.json(
        { error: 'Can only delete PENDING or FAILED payments' },
        { status: 409 }
      );
    }

    // Delete payment
    await prisma.payment.delete({
      where: { id: paymentId },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment' },
      { status: 500 }
    );
  }
}
