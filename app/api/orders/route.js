import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canCreateOrders, canViewInventory } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/orders
 * List all orders (requires order access permission)
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canViewInventory, // All authenticated users can view orders
    'You do not have permission to view orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');

    // Build where clause
    const where = {};
    
    if (patientId) {
      where.customerId = patientId;
      where.customerType = 'patient';
    }
    
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemName: true,
                itemCode: true,
                category: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch patients for orders where customerType is 'patient'
    const patientIds = [...new Set(
      orders
        .filter(order => order.customerType === 'patient')
        .map(order => order.customerId)
    )];

    const patients = patientIds.length > 0 ? await prisma.patient.findMany({
      where: { id: { in: patientIds } },
      select: {
        id: true,
        patientNumber: true,
        firstName: true,
        lastName: true,
      },
    }) : [];

    const patientMap = new Map(patients.map(p => [p.id, p]));

    // Attach patient data to orders
    const ordersWithPatients = orders.map(order => ({
      ...order,
      patient: order.customerType === 'patient' ? patientMap.get(order.customerId) || null : null,
    }));

    return NextResponse.json({
      success: true,
      orders: ordersWithPatients,
      count: ordersWithPatients.length,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Create a new order (requires create order permission)
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canCreateOrders,
    'You do not have permission to create orders'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { patientId, notes, items } = body;

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one order item is required' },
        { status: 400 }
      );
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Validate all inventory items exist and are active
    const inventoryItemIds = items.map((item) => item.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        id: { in: inventoryItemIds },
      },
    });

    if (inventoryItems.length !== inventoryItemIds.length) {
      return NextResponse.json(
        { error: 'One or more inventory items not found' },
        { status: 404 }
      );
    }

    // Check if all items are active
    const inactiveItems = inventoryItems.filter((item) => !item.isActive);
    if (inactiveItems.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot add inactive inventory items to order',
          inactiveItems: inactiveItems.map((i) => i.itemName),
        },
        { status: 400 }
      );
    }

    // Create a map of inventory items for quick lookup
    const inventoryMap = new Map(
      inventoryItems.map((item) => [item.id, item])
    );

    // Calculate order totals and prepare items
    let subtotal = 0;
    const orderItemsData = items.map((item) => {
      const inventoryItem = inventoryMap.get(item.inventoryItemId);
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice ?? Number(inventoryItem.unitPrice);
      const lineTotal = quantity * unitPrice;
      
      subtotal += lineTotal;

      return {
        inventoryItemId: item.inventoryItemId,
        quantity,
        unitPrice,
        lineTotal,
      };
    });

    const discount = 0;
    const tax = 0;
    const totalAmount = subtotal - discount + tax;

    // Create order with items in a transaction
    const order = await prisma.order.create({
      data: {
        customerId: patientId,
        customerType: 'patient',
        orderNumber: await generateOrderNumber(),
        status: 'PENDING',
        subtotal,
        discount,
        tax,
        totalAmount,
        amountPaid: 0,
        balance: totalAmount,
        notes: notes || null,
        orderItems: {
          create: orderItemsData,
        },
      },
      include: {
        orderItems: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                itemName: true,
                itemCode: true,
                category: true,
                unitPrice: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      order,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

/**
 * Generate unique order number
 */
async function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Get count of orders today
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `ORD-${year}${month}${day}-${sequence}`;
}
