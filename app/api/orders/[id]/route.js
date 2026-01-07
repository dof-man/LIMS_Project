import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders, canViewInventory } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/orders/[id]
 * Get a single order with all items
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canViewInventory,
    'You do not have permission to view orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemName: true,
                itemCode: true,
                category: true,
                description: true,
                unitPrice: true,
                requiresSample: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch patient if customerType is 'patient'
    let patient = null;
    if (order.customerType === 'patient') {
      patient = await prisma.patient.findUnique({
        where: { id: order.customerId },
        select: {
          id: true,
          patientNumber: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          phone: true,
          email: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        patient,
      },
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]
 * Update an order (status, notes, or recalculate total)
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to update orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = params;
    const body = await request.json();
    const { status, notes } = body;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Update order
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        patient: {
          select: {
            id: true,
            patientNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order (only if PENDING and no payments)
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to delete orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = params;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            payments: true,
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order has payments
    if (existingOrder._count.payments > 0) {
      return NextResponse.json(
        { error: 'Cannot delete order with payments' },
        { status: 409 }
      );
    }

    // Check if order is not pending
    if (existingOrder.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete PENDING orders' },
        { status: 409 }
      );
    }

    // Delete order (cascade will delete items)
    await prisma.order.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
