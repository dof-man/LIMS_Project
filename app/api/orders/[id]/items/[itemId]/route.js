import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * PUT /api/orders/[orderId]/items/[itemId]
 * Update an order item (quantity or unit price)
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to modify orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId, itemId } = params;
    const body = await request.json();
    const { quantity, unitPrice } = body;

    // Check if order item exists
    const existingItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Verify item belongs to the order
    if (existingItem.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Item does not belong to this order' },
        { status: 400 }
      );
    }

    // Check if order is modifiable
    if (existingItem.order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only modify PENDING orders' },
        { status: 409 }
      );
    }

    // Validate quantity
    if (quantity !== undefined && (quantity < 1 || !Number.isInteger(quantity))) {
      return NextResponse.json(
        { error: 'Quantity must be a positive integer' },
        { status: 400 }
      );
    }

    // Validate unit price
    if (unitPrice !== undefined && (unitPrice < 0 || typeof unitPrice !== 'number')) {
      return NextResponse.json(
        { error: 'Unit price must be a positive number' },
        { status: 400 }
      );
    }

    // Calculate new line total
    const newQuantity = quantity ?? existingItem.quantity;
    const newUnitPrice = unitPrice ?? Number(existingItem.unitPrice);
    const newLineTotal = newQuantity * newUnitPrice;

    // Update item and recalculate order total in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order item
      const updatedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(quantity !== undefined && { quantity }),
          ...(unitPrice !== undefined && { unitPrice }),
          lineTotal: newLineTotal,
        },
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
      });

      // Recalculate order total
      const items = await tx.orderItem.findMany({
        where: { orderId },
      });

      const newTotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

      // Update order total
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { total: newTotal },
        include: {
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

      return { item: updatedItem, order: updatedOrder };
    });

    return NextResponse.json({
      success: true,
      item: result.item,
      order: result.order,
    });
  } catch (error) {
    console.error('Error updating order item:', error);
    return NextResponse.json(
      { error: 'Failed to update order item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[orderId]/items/[itemId]
 * Remove an order item
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to modify orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId, itemId } = params;

    // Check if order item exists
    const existingItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Order item not found' },
        { status: 404 }
      );
    }

    // Verify item belongs to the order
    if (existingItem.orderId !== orderId) {
      return NextResponse.json(
        { error: 'Item does not belong to this order' },
        { status: 400 }
      );
    }

    // Check if order is modifiable
    if (existingItem.order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only modify PENDING orders' },
        { status: 409 }
      );
    }

    // Check if this is the last item
    const itemCount = await prisma.orderItem.count({
      where: { orderId },
    });

    if (itemCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove last item. Delete the order instead.' },
        { status: 409 }
      );
    }

    // Delete item and recalculate order total in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete order item
      await tx.orderItem.delete({
        where: { id: itemId },
      });

      // Recalculate order total
      const items = await tx.orderItem.findMany({
        where: { orderId },
      });

      const newTotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

      // Update order total
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { total: newTotal },
        include: {
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

      return { order: updatedOrder };
    });

    return NextResponse.json({
      success: true,
      message: 'Order item deleted successfully',
      order: result.order,
    });
  } catch (error) {
    console.error('Error deleting order item:', error);
    return NextResponse.json(
      { error: 'Failed to delete order item' },
      { status: 500 }
    );
  }
}
