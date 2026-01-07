import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import { canAccessPatients } from '@/lib/rbac';

/**
 * GET /api/patients/[id]/history
 * Get patient's complete medical history
 * Includes orders, test requests, and payments
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to view patient history'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id: patientId } = await params;

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        patientNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        email: true,
        medicalHistory: true,
        allergies: true,
        createdAt: true,
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Fetch orders with items and payments
    const orders = await prisma.order.findMany({
      where: { 
        customerId: patientId,
        customerType: 'patient'
      },
      include: {
        orderItems: {
          include: {
            inventoryItem: {
              select: {
                itemName: true,
                itemCode: true,
                category: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentMethod: true,
            status: true,
            paymentDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch test requests
    const testRequests = await prisma.testRequest.findMany({
      where: { patientId },
      include: {
        testRequestItems: {
          include: {
            orderItem: {
              include: {
                inventoryItem: {
                  select: {
                    itemName: true,
                    itemCode: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
        labResults: {
          select: {
            id: true,
            status: true,
            testedDate: true,
            verifiedDate: true,
            releasedDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate statistics
    const totalOrders = orders.length;
    const totalTestRequests = testRequests.length;
    
    const orderStats = {
      total: totalOrders,
      pending: orders.filter(o => o.status === 'PENDING').length,
      confirmed: orders.filter(o => o.status === 'CONFIRMED').length,
      completed: orders.filter(o => o.status === 'COMPLETED').length,
      cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    };

    const testRequestStats = {
      total: totalTestRequests,
      pending: testRequests.filter(t => t.status === 'PENDING').length,
      sampleCollected: testRequests.filter(t => t.status === 'SAMPLE_COLLECTED').length,
      inProgress: testRequests.filter(t => t.status === 'IN_PROGRESS').length,
      completed: testRequests.filter(t => t.status === 'COMPLETED').length,
      cancelled: testRequests.filter(t => t.status === 'CANCELLED').length,
    };

    // Calculate total spent
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
    
    // Calculate total paid
    const totalPaid = orders.reduce((sum, order) => {
      const orderPaid = order.payments
        .filter(p => p.status === 'COMPLETED' || p.status === 'PENDING')
        .reduce((pSum, payment) => pSum + Number(payment.amount), 0);
      return sum + orderPaid;
    }, 0);

    const outstandingBalance = totalSpent - totalPaid;

    return NextResponse.json({
      success: true,
      history: {
        patient,
        orders,
        testRequests,
        statistics: {
          orders: orderStats,
          testRequests: testRequestStats,
          financial: {
            totalSpent,
            totalPaid,
            outstandingBalance,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching patient history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patient history' },
      { status: 500 }
    );
  }
}
