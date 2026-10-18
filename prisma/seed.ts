import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@localhost";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMeNow!";
  const name = process.env.ADMIN_NAME ?? "Treasury Admin";

  await prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "SUPER_ADMIN", isActive: true },
    create: { email, name, passwordHash, role: "SUPER_ADMIN" },
  });

  console.info(`Seeded administrator ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
