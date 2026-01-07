import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canManageInventory, canViewInventory } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/inventory
 * List all inventory items (requires view inventory permission)
 */
export async function GET(request) {
  const authResult = await requirePermission(
    request,
    canViewInventory,
    'You do not have permission to view inventory'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const search = searchParams.get('search');

    // Build where clause
    const where = {};
    
    if (category) {
      where.category = category;
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { itemCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: {
        itemName: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory
 * Create a new inventory item (requires manage inventory permission - ADMIN only)
 */
export async function POST(request) {
  const authResult = await requirePermission(
    request,
    canManageInventory,
    'You do not have permission to manage inventory'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const {
      itemName,
      itemCode,
      category,
      description,
      unitPrice,
      resultMode,
      requiresSample,
      isActive,
    } = body;

    // Validate required fields
    if (!itemName || !itemCode || !category || unitPrice === undefined || unitPrice === null) {
      return NextResponse.json(
        { error: 'Name, code, category, and price are required' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['LAB_TEST', 'RADIOLOGY', 'CONSULTATION', 'PROCEDURE', 'SUPPLIES', 'OTHER'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate result mode
    if (resultMode) {
      const validResultModes = ['LAB_PARAMETER', 'FREE_TEXT', 'NONE'];
      if (!validResultModes.includes(resultMode)) {
        return NextResponse.json(
          { error: `Invalid result mode. Must be one of: ${validResultModes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate price
    if (typeof unitPrice !== 'number' || unitPrice < 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { itemCode },
    });

    if (existingItem) {
      return NextResponse.json(
        { error: 'An item with this code already exists' },
        { status: 409 }
      );
    }

    // Create inventory item
    const item = await prisma.inventoryItem.create({
      data: {
        itemName,
        itemCode,
        category,
        description: description || null,
        unitPrice,
        requiresSample: requiresSample === true,
        isActive: isActive !== false, // Default to true
      },
    });

    return NextResponse.json({
      success: true,
      item,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    );
  }
}
