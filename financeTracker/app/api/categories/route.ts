import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/categories - List all categories with hierarchy
export async function GET() {
  try {
    const categories = db
      .prepare(
        `
      SELECT id, name, parent_id, icon, color, is_system, created_at, updated_at
      FROM categories
      ORDER BY name ASC
    `
      )
      .all();

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, parent_id = null, icon = null, color = null } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const result = db
      .prepare(
        `
      INSERT INTO categories (name, parent_id, icon, color, is_system)
      VALUES (@name, @parent_id, @icon, @color, 0)
    `
      )
      .run({
        name: name.trim(),
        parent_id,
        icon,
        color,
      });

    const newCategory = db
      .prepare(
        `
      SELECT id, name, parent_id, icon, color, is_system, created_at, updated_at
      FROM categories
      WHERE id = @id
    `
      )
      .get({ id: result.lastInsertRowid });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    console.error("Error creating category:", error);

    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return NextResponse.json(
        {
          error:
            "A category with this name already exists under the same parent",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
