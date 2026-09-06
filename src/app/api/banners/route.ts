import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const banners = await prisma.banner.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json(banners);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, subtitle, imageUrl, link, order } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { error: "Título e imagen son requeridos" },
        { status: 400 }
      );
    }

    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle,
        imageUrl,
        link,
        order: parseInt(order) || 0,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Error al crear banner" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const banner = await prisma.banner.update({
      where: { id },
      data,
    });

    return NextResponse.json(banner);
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar banner" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    await prisma.banner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar banner" }, { status: 500 });
  }
}
