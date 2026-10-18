import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listLocalOperations } from "@/server/history";
import { historyQuerySchema } from "@/lib/validation";
import { createAdmin, createPanel, resetDb } from "./helpers";
import { submitBatch } from "@/server/payments";

describe("history filtering and pagination", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("caps remote page size at 1000 and accepts documented filters", () => {
    const parsed = historyQuerySchema.parse({
      username: "john",
      payment_status: "completed",
      limit: "5000",
      offset: "0",
      sort: "id_desc",
    });
    expect(parsed.limit).toBe(1000);
    expect(parsed.username).toBe("john");
  });

  it("filters local operations by username and paginates", async () => {
    const admin = await createAdmin();
    const panel = await createPanel("Panel A");
    await submitBatch(
      {
        name: "History",
        workflow: "MIXED_ROWS",
        clientSubmissionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        confirmation: true,
        rows: [
          { clientRowId: "1", panelId: panel.id, username: "john", amount: "10", method: "Admin Credit" },
          { clientRowId: "2", panelId: panel.id, username: "alex", amount: "11", method: "Admin Credit" },
        ],
      },
      admin.id,
    );
    await prisma.paymentOperation.updateMany({
      where: { username: "john" },
      data: { status: "COMPLETED", remotePaymentId: "pay_1" },
    });

    const page = await listLocalOperations({ username: "john", page: 1, pageSize: 1 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.username).toBe("john");
    expect(page.items[0]?.remotePaymentId).toBe("pay_1");
  });
});
