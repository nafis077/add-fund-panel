import { prisma } from "@/lib/prisma";
import { hashPassword, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { assertSameOrigin, clientIp, handleRouteError, json } from "@/lib/http";
import { USER_ROLES } from "@/types/domain";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(USER_ROLES),
});

export async function GET() {
  try {
    await requirePermission("admins.manage");
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("admins.manage");
    const data = schema.parse(await request.json());
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash: await hashPassword(data.password),
        role: data.role,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    await writeAudit({
      actorId: session.id,
      action: "admin.create",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
      ipAddress: clientIp(request),
    });
    return json({ user }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
