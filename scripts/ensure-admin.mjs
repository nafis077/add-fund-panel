import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

function requiredSecret(name, minLength = 16) {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(`${name} must be set to a long random value before starting`);
  }
}

async function main() {
  requiredSecret("AUTH_SECRET");
  requiredSecret("ENCRYPTION_KEY");

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const email = (process.env.ADMIN_EMAIL ?? "admin@localhost").toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.info(`Administrator ${email} already exists`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password || password === "ChangeMeNow!") {
    throw new Error("Set a unique ADMIN_PASSWORD before the first Railway deploy");
  }

  await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME ?? "Treasury Admin",
      passwordHash: await hash(password, 12),
      role: "SUPER_ADMIN",
    },
  });
  console.info(`Created administrator ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
