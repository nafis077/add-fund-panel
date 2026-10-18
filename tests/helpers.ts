import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import type { UserRole } from "@/types/domain";

export async function resetDb() {
  await prisma.paymentAttempt.deleteMany();
  await prisma.paymentOperation.deleteMany();
  await prisma.paymentBatchPanel.deleteMany();
  await prisma.paymentAuditLog.deleteMany();
  await prisma.paymentBatch.deleteMany();
  await prisma.panel.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.appSetting.create({ data: { id: "default" } });
}

export async function createAdmin(role: UserRole = "SUPER_ADMIN", email = "admin@localhost") {
  return prisma.user.create({
    data: {
      email,
      name: role,
      passwordHash: await hash("secret123", 4),
      role,
    },
  });
}

export async function createPanel(name: string, overrides: Record<string, unknown> = {}) {
  return prisma.panel.create({
    data: {
      name,
      baseUrl: `https://${name.toLowerCase().replaceAll(/\s+/g, "")}.example`,
      encryptedApiKey: encryptSecret("panel-admin-key-123456"),
      apiKeyLast4: "3456",
      currency: "USD",
      isActive: true,
      connectionStatus: "CONNECTED",
      ...overrides,
    },
  });
}

export function successPaymentResponse(id: string, balance = "100") {
  return {
    error_code: 0,
    error_message: "",
    data: { id, balance, currency: "USD" },
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
