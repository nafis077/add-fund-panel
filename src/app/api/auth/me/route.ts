import { getSession } from "@/lib/auth";
import { permissionsFor } from "@/lib/permissions";
import { json } from "@/lib/http";

export async function GET() {
  const session = await getSession();
  if (!session) return json({ user: null });
  return json({ user: session, permissions: permissionsFor(session.role) });
}
