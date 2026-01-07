import { NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/lib/middleware';
import prisma from '@/lib/prisma';
import { canAccessPatients, canModifyPatients } from '@/lib/rbac';

/**
 * Generate unique Medical Record Number (MRN)
 * Format: MRN-YYYYMMDD-XXXX
 */
async function generateUniqueMRN() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  // Find the highest sequence number for today
  const lastPatient = await prisma.patient.findFirst({
    where: {
      patientNumber: {
        startsWith: `MRN-${datePrefix}`,
      },
    },
    orderBy: {
      patientNumber: 'desc',
    },
  });

  let sequence = 1;
  if (lastPatient) {
    const lastSequence = parseInt(lastPatient.patientNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `MRN-${datePrefix}-${String(sequence).padStart(4, '0')}`;
}

/**
 * GET /api/patients
 * List patients with search and filter capabilities
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canAccessPatients,
    'You do not have permission to view patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    // Search by MRN, name, phone, or email
    if (search) {
      where.OR = [
        { patientNumber: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by gender
    if (gender && ['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
      where.gender = gender;
    }

    // Fetch patients with pagination
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          patientNumber: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          gender: true,
          phone: true,
          email: true,
          address: true,
          city: true,
          state: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      patients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patients' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patients
 * Create new patient with auto-generated MRN
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canModifyPatients,
    'You do not have permission to create patients'
  );
  
  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
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

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender) {
      return NextResponse.json(
        { error: 'First name, last name, date of birth, and gender are required' },
        { status: 400 }
      );
    }

    // Validate gender
    if (!['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
      return NextResponse.json(
        { error: 'Gender must be MALE, FEMALE, or OTHER' },
        { status: 400 }
      );
    }

    // Generate unique MRN
    const mrn = await generateUniqueMRN();

    // Create patient record
    const patient = await prisma.patient.create({
      data: {
        patientNumber: mrn,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        phone: phone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        emergencyContact: emergencyContact || null,
        emergencyPhone: emergencyPhone || null,
        medicalHistory: medicalHistory || null,
        allergies: allergies || null,
      },
    });

    return NextResponse.json({
      success: true,
      patient,
      message: `Patient registered successfully with MRN: ${mrn}`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { error: 'Failed to create patient' },
      { status: 500 }
    );
  }
}
