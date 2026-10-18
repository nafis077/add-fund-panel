import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";

export async function getSettings() {
  return prisma.appSetting.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function updateSettings(input: unknown, actorId: string, ip?: string) {
  await requirePermission("settings.manage");
  const data = settingsSchema.parse(input);
  const settings = await prisma.appSetting.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  await writeAudit({
    actorId,
    action: "settings.update",
    entityType: "AppSetting",
    entityId: settings.id,
    metadata: data,
    ipAddress: ip,
  });
  return settings;
}
