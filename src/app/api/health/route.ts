import { prisma } from "@/lib/prisma";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, service: "panel-treasury" });
  } catch {
    return json({ ok: false, service: "panel-treasury" }, 503);
  }
}
