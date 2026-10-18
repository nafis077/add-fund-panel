import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { applyBootSecrets } from "./boot-secrets.mjs";

applyBootSecrets(process.env);

const prisma = new PrismaClient();

async function main() {
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

  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password || password === "ChangeMeNow!") {
    password = randomBytes(12).toString("base64url");
    generated = true;
  }

  await prisma.user.create({
    data: {
      email,
      name: process.env.ADMIN_NAME ?? "Treasury Admin",
      passwordHash: await hash(password, 12),
      role: "SUPER_ADMIN",
    },
  });

  if (generated) {
    console.warn(`[boot] Created ${email} with a generated password: ${password}`);
    console.warn("[boot] Sign in with that password, then change it. Or set ADMIN_PASSWORD and recreate the user.");
  } else {
    console.info(`Created administrator ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
