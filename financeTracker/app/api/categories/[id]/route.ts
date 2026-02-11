import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/categories/[id] - Get single category
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const category = db.prepare(`
      SELECT id, name, parent_id, icon, color, is_system, created_at, updated_at
      FROM categories
      WHERE id = @id
    `).get({ id: params.id });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, parent_id, icon, color } = body;

    // Check if category exists and is not a system category
    const existing = db.prepare(`
      SELECT is_system FROM categories WHERE id = @id
    `).get({ id: params.id }) as { is_system: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (existing.is_system === 1) {
      return NextResponse.json(
        { error: 'Cannot modify system categories' },
        { status: 403 }
      );
    }

    // Validation
    if (name && (typeof name !== 'string' || name.trim() === '')) {
      return NextResponse.json(
        { error: 'Name must be a non-empty string' },
        { status: 400 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: Record<string, any> = { id: params.id };

    if (name !== undefined) {
      updates.push('name = @name');
      values.name = name.trim();
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = @parent_id');
      values.parent_id = parent_id;
    }
    if (icon !== undefined) {
      updates.push('icon = @icon');
      values.icon = icon;
    }
    if (color !== undefined) {
      updates.push('color = @color');
      values.color = color;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    db.prepare(`
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE id = @id
    `).run(values);

    const updatedCategory = db.prepare(`
      SELECT id, name, parent_id, icon, color, is_system, created_at, updated_at
      FROM categories
      WHERE id = @id
    `).get({ id: params.id });

    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error('Error updating category:', error);

    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'A category with this name already exists under the same parent' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if category exists and is not a system category
    const existing = db.prepare(`
      SELECT is_system FROM categories WHERE id = @id
    `).get({ id: params.id }) as { is_system: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (existing.is_system === 1) {
      return NextResponse.json(
        { error: 'Cannot delete system categories' },
        { status: 403 }
      );
    }

    // Check if category has transactions
    const transactionCount = db.prepare(`
      SELECT COUNT(*) as count FROM transactions WHERE category_id = @id
    `).get({ id: params.id }) as { count: number };

    if (transactionCount.count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${transactionCount.count} associated transactions` },
        { status: 409 }
      );
    }

    db.prepare('DELETE FROM categories WHERE id = @id').run({ id: params.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
