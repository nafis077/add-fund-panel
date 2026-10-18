import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";
import { storageReport } from "@/lib/storage-mode";

export const dynamic = "force-dynamic";

export async function GET() {
  const storage = storageReport();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, service: "panel-treasury", storage });
  } catch {
    return json({ ok: false, service: "panel-treasury", storage }, 503);
  }
}
