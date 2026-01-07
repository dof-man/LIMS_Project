import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * POST /api/orders/[id]/items
 * Add an item to an order
 */
export async function POST(request, { params }) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to modify orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: orderId } = params;
    const body = await request.json();
    const { inventoryItemId, quantity, unitPrice } = body;

    // Validate required fields
    if (!inventoryItemId) {
      return NextResponse.json(
        { error: 'Inventory item ID is required' },
        { status: 400 }
      );
    }

    // Check if order exists and is modifiable
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only modify PENDING orders' },
        { status: 409 }
      );
    }

    // Check if inventory item exists and is active
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: inventoryItemId },
    });

    if (!inventoryItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    if (!inventoryItem.isActive) {
      return NextResponse.json(
        { error: 'Cannot add inactive inventory item' },
        { status: 400 }
      );
    }

    // Calculate line total
    const qty = quantity || 1;
    const price = unitPrice ?? Number(inventoryItem.price);
    const lineTotal = qty * price;

    // Check if item already exists in order
    const existingItem = await prisma.orderItem.findFirst({
      where: {
        orderId,
        inventoryItemId,
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: 'Item already exists in order. Use PUT to update quantity.' },
        { status: 409 }
      );
    }

    // Add item and update order total in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create order item
      const orderItem = await tx.orderItem.create({
        data: {
          orderId,
          inventoryItemId,
          quantity: qty,
          unitPrice: price,
          lineTotal,
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

      return { orderItem, order: updatedOrder };
    });

    return NextResponse.json({
      success: true,
      item: result.orderItem,
      order: result.order,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding order item:', error);
    return NextResponse.json(
      { error: 'Failed to add order item' },
      { status: 500 }
    );
  }
}
