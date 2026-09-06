import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { name, description, order } = body;

    if (!name) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }

    const slug = slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        order: parseInt(order) || 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear categoría" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { id, name, description, order } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "id y nombre son requeridos" }, { status: 400 });
    }

    const slug = slugify(name);
    const existing = await prisma.category.findFirst({
      where: { slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ya existe otra categoría con ese nombre" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order: parseInt(order) || 0 }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id es requerido" }, { status: 400 });
    }

    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: tiene ${count} producto${count !== 1 ? "s" : ""} asignado${count !== 1 ? "s" : ""}. Reasíginalos primero.` },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar categoría" }, { status: 500 });
  }
}
