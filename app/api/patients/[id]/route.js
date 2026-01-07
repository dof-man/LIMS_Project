import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import { canAccessPatients, canModifyPatients } from '@/lib/rbac';

/**
 * GET /api/patients/[id]
 * Get single patient with full details
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to view patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            testRequests: true,
            samples: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      patient,
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patient' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patients/[id]
 * Update patient information (RECEPTION, ADMIN, SUPERUSER only)
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyPatients,
    'You do not have permission to edit patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      emergencyContact,
      emergencyPhone,
      medicalHistory,
      allergies,
    } = body;

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id },
    });

    if (!existingPatient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Validate gender if provided
    if (gender && !['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
      return NextResponse.json(
        { error: 'Gender must be MALE, FEMALE, or OTHER' },
        { status: 400 }
      );
    }

    // Update patient
    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(dateOfBirth !== undefined && { dateOfBirth: new Date(dateOfBirth) }),
        ...(gender !== undefined && { gender }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zipCode !== undefined && { zipCode }),
        ...(emergencyContact !== undefined && { emergencyContact }),
        ...(emergencyPhone !== undefined && { emergencyPhone }),
        ...(medicalHistory !== undefined && { medicalHistory }),
        ...(allergies !== undefined && { allergies }),
      },
    });

    return NextResponse.json({
      success: true,
      patient: updatedPatient,
      message: 'Patient updated successfully',
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { error: 'Failed to update patient' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patients/[id]
 * Delete patient (ADMIN and SUPERUSER only)
 * Only allowed if patient has no associated records
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canModifyPatients,
    'You do not have permission to delete patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = params;

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            testRequests: true,
            orders: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Check if patient has any associated records
    if (patient._count.testRequests > 0 || patient._count.orders > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete patient with existing test requests or orders',
          details: {
            testRequests: patient._count.testRequests,
            orders: patient._count.orders,
          },
        },
        { status: 409 }
      );
    }

    // Delete patient
    await prisma.patient.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json(
      { error: 'Failed to delete patient' },
      { status: 500 }
    );
  }
}
