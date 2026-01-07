import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canAccessPatients } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * Generate unique Test Request Number
 * Format: TR-YYYYMMDD-XXXX
 */
async function generateTestRequestNumber() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  const lastRequest = await prisma.testRequest.findFirst({
    where: {
      requestNumber: {
        startsWith: `TR-${datePrefix}`,
      },
    },
    orderBy: {
      requestNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastRequest) {
    const lastSequence = parseInt(lastRequest.requestNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `TR-${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate unique Order Number
 * Format: ORD-YYYYMMDD-XXXX
 */
async function generateOrderNumber() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: `ORD-${datePrefix}`,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `ORD-${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * GET /api/test-requests
 * List test requests with filters
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to view test requests'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where = {};

    if (patientId) {
      where.patientId = patientId;
    }

    if (status && ['PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { requestNumber: { contains: search, mode: 'insensitive' } },
        { patient: { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { patientNumber: { contains: search, mode: 'insensitive' } },
          ]
        }},
      ];
    }

    const [testRequests, total] = await Promise.all([
      prisma.testRequest.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              patientNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          testRequestItems: {
            include: {
              orderItem: {
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
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              totalAmount: true,
              status: true,
            },
          },
          labResults: {
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.testRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      testRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching test requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/test-requests
 * Create test request with automatic order generation
 * This creates both clinical records (test_requests) and billing records (orders)
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to create test requests'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const {
      patientId,
      items, // Array of { inventoryItemId, notes, urgency }
      clinicalNotes,
      requestedBy,
    } = body;

    // Validate required fields
    if (!patientId) {
      return NextResponse.json(
        { error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one test item is required' },
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

    // Validate and fetch all inventory items
    const inventoryItemIds = items.map(item => item.inventoryItemId);
    const inventoryItems = await prisma.inventoryItem.findMany({
      where: {
        id: { in: inventoryItemIds },
        isActive: true,
      },
    });

    if (inventoryItems.length !== inventoryItemIds.length) {
      return NextResponse.json(
        { error: 'One or more inventory items not found or inactive' },
        { status: 400 }
      );
    }

    // Validate that all items are investigation categories
    const validCategories = ['LAB_TEST', 'RADIOLOGY', 'PROCEDURE'];
    const invalidItems = inventoryItems.filter(
      item => !validCategories.includes(item.category)
    );

    if (invalidItems.length > 0) {
      return NextResponse.json(
        { 
          error: 'Only LAB_TEST, RADIOLOGY, and PROCEDURE items can be used for test requests',
          invalidItems: invalidItems.map(i => ({ id: i.id, itemName: i.itemName, category: i.category })),
        },
        { status: 400 }
      );
    }

    // Generate numbers
    const testRequestNumber = await generateTestRequestNumber();
    const orderNumber = await generateOrderNumber();

    // Create test requests and order in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate order total
      let orderTotal = 0;
      const orderItemsData = [];

      for (const item of items) {
        const inventoryItem = inventoryItems.find(inv => inv.id === item.inventoryItemId);
        const quantity = item.quantity || 1;
        const unitPrice = Number(inventoryItem.unitPrice);
        const discount = 0;
        const tax = 0;
        const totalPrice = quantity * unitPrice;

        orderTotal += totalPrice;

        // Prepare order item data
        orderItemsData.push({
          inventoryItemId: item.inventoryItemId,
          quantity,
          unitPrice,
          discount,
          tax,
          totalPrice,
        });
      }

      // Create order with items
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: patientId,
          customerType: 'patient',
          customerName: `${patient.firstName} ${patient.lastName}`,
          orderType: 'lab',
          subtotal: orderTotal,
          discount: 0,
          tax: 0,
          totalAmount: orderTotal,
          amountPaid: 0,
          balance: orderTotal,
          status: 'confirmed',
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          orderItems: true,
        },
      });

      // Create single test request linked to the order
      const testRequest = await tx.testRequest.create({
        data: {
          requestNumber: testRequestNumber,
          patientId,
          orderId: order.id,
          status: 'pending',
          priority: 'normal',
          clinicalNotes: clinicalNotes || null,
          requestingDoctor: requestedBy || null,
        },
      });

      // Create test request items linking to order items
      const testRequestItemsData = order.orderItems.map(orderItem => ({
        testRequestId: testRequest.id,
        orderItemId: orderItem.id,
        status: 'pending',
      }));

      await tx.testRequestItem.createMany({
        data: testRequestItemsData,
      });

      return {
        testRequest,
        order,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Test request ${testRequestNumber} created successfully with ${items.length} test(s)`,
      testRequest: result.testRequest,
      order: result.order,
      summary: {
        testRequestNumber,
        orderNumber: result.order.orderNumber,
        patientMRN: patient.patientNumber,
        patientName: `${patient.firstName} ${patient.lastName}`,
        totalTests: items.length,
        orderTotal: result.order.totalAmount,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating test request:', error);
    return NextResponse.json(
      { error: 'Failed to create test request' },
      { status: 500 }
    );
  }
}
