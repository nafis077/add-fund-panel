import { prisma } from "@/lib/prisma";
import { attachSessionCookie, verifyPassword } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { clientIp, handleRouteError, json } from "@/lib/http";
import type { UserRole } from "@/types/domain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const allowed = await consumeRateLimit(`login:${ip}`, 8, 60_000);
    if (!allowed) return json({ error: "Too many login attempts" }, 429);

    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!email || !password) return json({ error: "Email and password are required" }, 400);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      return json({ error: "Invalid credentials" }, 401);
    }

    await writeAudit({
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: ip,
    });
    return attachSessionCookie(
      json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }),
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
      },
      request,
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
