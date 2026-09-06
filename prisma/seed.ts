import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.MDC_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.MDC_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("Admin omitido: define MDC_ADMIN_EMAIL y MDC_ADMIN_PASSWORD para crearlo.");
    return;
  }

  if (password.length < 12) {
    throw new Error("MDC_ADMIN_PASSWORD debe tener al menos 12 caracteres.");
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "admin" },
    create: {
      name: "Administrador",
      email,
      password: hashed,
      role: "admin",
    },
  });

  console.log(`Administrador preparado: ${email}`);
}

async function seedCategories() {
  const categories = [
    { name: "Herramientas", slug: "herramientas", order: 1 },
    { name: "Construcción", slug: "construccion", order: 2 },
    { name: "Eléctricos", slug: "electricos", order: 3 },
    { name: "Ferretería general", slug: "ferreteria", order: 4 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, order: category.order },
      create: category,
    });
  }

  console.log("Categorías MDC preparadas");
}

async function main() {
  await seedAdmin();
  await seedCategories();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
