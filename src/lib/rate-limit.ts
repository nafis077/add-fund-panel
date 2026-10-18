import { prisma } from "@/lib/prisma";

export async function consumeRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const bucket = await prisma.rateLimitBucket.findUnique({ where: { id: key } });
  if (!bucket) {
    await prisma.rateLimitBucket.create({ data: { id: key, tokens: limit - 1 } });
    return true;
  }
  const elapsed = now - bucket.updatedAt.getTime();
  const refill = Math.floor(elapsed / windowMs) * limit;
  const tokens = Math.min(limit, bucket.tokens + refill);
  if (tokens <= 0) return false;
  await prisma.rateLimitBucket.update({
    where: { id: key },
    data: { tokens: tokens - 1 },
  });
  return true;
}
