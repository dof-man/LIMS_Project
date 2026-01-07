import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware';
import { canManageInventory, canViewInventory } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * GET /api/inventory/[id]
 * Get a single inventory item (requires view inventory permission)
 */
export async function GET(request, { params }) {
  const authResult = await requirePermission(
    request,
    canViewInventory,
    'You do not have permission to view inventory'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory item' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/inventory/[id]
 * Update an inventory item (requires manage inventory permission - ADMIN only)
 */
export async function PUT(request, { params }) {
  const authResult = await requirePermission(
    request,
    canManageInventory,
    'You do not have permission to manage inventory'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
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

    // Check if item exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['LAB_TEST', 'RADIOLOGY', 'CONSULTATION', 'PROCEDURE', 'SUPPLIES', 'OTHER'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate result mode if provided
    if (resultMode) {
      const validResultModes = ['LAB_PARAMETER', 'FREE_TEXT', 'NONE'];
      if (!validResultModes.includes(resultMode)) {
        return NextResponse.json(
          { error: `Invalid result mode. Must be one of: ${validResultModes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate price if provided
    if (unitPrice !== undefined && unitPrice !== null) {
      if (typeof unitPrice !== 'number' || unitPrice < 0) {
        return NextResponse.json(
          { error: 'Price must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Check if new code conflicts with another item
    if (itemCode && itemCode !== existingItem.itemCode) {
      const codeConflict = await prisma.inventoryItem.findUnique({
        where: { itemCode },
      });

      if (codeConflict) {
        return NextResponse.json(
          { error: 'An item with this code already exists' },
          { status: 409 }
        );
      }
    }

    // Update inventory item
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(itemName && { itemName }),
        ...(itemCode && { itemCode }),
        ...(category && { category }),
        ...(description !== undefined && { description }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(requiresSample !== undefined && { requiresSample }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/[id]
 * Delete an inventory item (requires manage inventory permission - ADMIN only)
 */
export async function DELETE(request, { params }) {
  const authResult = await requirePermission(
    request,
    canManageInventory,
    'You do not have permission to manage inventory'
  );

  if (!authResult.authenticated || !authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;

    // Check if item exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            testRequestItems: true,
          },
        },
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Check if item is used in orders or test requests
    if (existingItem._count.orderItems > 0 || existingItem._count.testRequestItems > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete inventory item that is used in orders or test requests',
          details: {
            orderItems: existingItem._count.orderItems,
            testRequestItems: existingItem._count.testRequestItems,
          },
        },
        { status: 409 }
      );
    }

    // Delete inventory item
    await prisma.inventoryItem.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    );
  }
}
