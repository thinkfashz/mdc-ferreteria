import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@mdc.com";
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existing) {
    const hashed = await bcrypt.hash("admin123", 12);
    await prisma.user.create({
      data: {
        name: "Administrador",
        email: adminEmail,
        password: hashed,
        role: "admin",
      },
    });
    console.log("Admin user created: admin@mdc.com / admin123");
  } else {
    console.log("Admin user already exists");
  }

  const categories = [
    { name: "Herramientas", slug: "herramientas", order: 1 },
    { name: "Materiales", slug: "materiales", order: 2 },
    { name: "Electricidad", slug: "electricidad", order: 3 },
    { name: "Plomería", slug: "plomeria", order: 4 },
    { name: "Pintura", slug: "pintura", order: 5 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log("Categories seeded");

  const sampleProducts = [
    {
      name: "Martillo Profesional 16oz",
      slug: "martillo-profesional-16oz",
      description: "Martillo de acero forjado con mango de fibra de vidrio",
      price: 289.99,
      sku: "HERR-001",
      barcode: "7501234567890",
      stock: 45,
      minStock: 10,
      unit: "pieza",
      featured: true,
      categorySlug: "herramientas",
    },
    {
      name: "Taladro Percutor 1/2",
      slug: "taladro-percutor-1-2",
      description: "Taladro percutor inalámbrico 20V con 2 baterías",
      price: 1899.00,
      sku: "HERR-002",
      barcode: "7501234567891",
      stock: 12,
      minStock: 5,
      unit: "pieza",
      featured: true,
      categorySlug: "herramientas",
    },
    {
      name: "Cable THW 12 AWG (rollo 100m)",
      slug: "cable-thw-12-awg",
      description: "Cable eléctrico THW 12 AWG rollo de 100 metros",
      price: 1250.00,
      sku: "ELEC-001",
      stock: 25,
      minStock: 10,
      unit: "rollo",
      featured: false,
      categorySlug: "electricidad",
    },
    {
      name: "Tubo PVC 2\" (barra 6m)",
      slug: "tubo-pvc-2",
      description: "Tubo PVC sanitario de 2 pulgadas barra de 6 metros",
      price: 189.00,
      sku: "PLOM-001",
      stock: 80,
      minStock: 20,
      unit: "pieza",
      featured: false,
      categorySlug: "plomeria",
    },
    {
      name: "Pintura Vinílica Blanca 19L",
      slug: "pintura-vinilica-blanca-19l",
      description: "Pintura vinílica premium acabado mate 19 litros",
      price: 1450.00,
      sku: "PINT-001",
      stock: 3,
      minStock: 8,
      unit: "cubeta",
      featured: true,
      categorySlug: "pintura",
    },
    {
      name: "Cemento Gris 50kg",
      slug: "cemento-gris-50kg",
      description: "Cemento gris tipo II marca regional",
      price: 245.00,
      sku: "MAT-001",
      stock: 200,
      minStock: 50,
      unit: "pieza",
      featured: false,
      categorySlug: "materiales",
    },
  ];

  for (const prod of sampleProducts) {
    const cat = await prisma.category.findUnique({ where: { slug: prod.categorySlug } });
    await prisma.product.upsert({
      where: { slug: prod.slug },
      update: {},
      create: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        price: prod.price,
        sku: prod.sku,
        barcode: prod.barcode,
        stock: prod.stock,
        minStock: prod.minStock,
        unit: prod.unit,
        featured: prod.featured,
        categoryId: cat?.id,
      },
    });
  }
  console.log("Sample products seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
