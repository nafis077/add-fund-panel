import { z } from "zod";
import { parseAmount } from "@/lib/money";
import type { PaymentRowInput, PreviewIssue } from "@/types/domain";

export const panelInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  baseUrl: z
    .string()
    .trim()
    .url("Base API URL must be a valid URL")
    .refine((value) => /^https?:\/\//i.test(value), "Base API URL must start with http or https"),
  apiKey: z.string().trim().min(8).max(512).optional(),
  currency: z.string().trim().min(3).max(8).default("USD"),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  concurrencyLimit: z.number().int().min(1).max(5).optional(),
  minRequestIntervalMs: z.number().int().min(200).max(10_000).optional(),
});

export const paymentRowSchema = z.object({
  clientRowId: z.string().min(1),
  panelId: z.string().min(1),
  username: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/, "Username contains invalid characters"),
  amount: z.string().trim().min(1),
  method: z.string().trim().min(1).max(80),
  memo: z.string().trim().max(255).optional(),
  affiliateCommission: z.boolean().optional(),
  currency: z.string().trim().min(3).max(8).optional(),
});

export const batchSubmitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  workflow: z.enum(["SAME_USER", "MIXED_ROWS"]),
  clientSubmissionId: z.string().uuid(),
  confirmation: z.literal(true),
  rows: z.array(paymentRowSchema).min(1).max(5000),
});

export const historyQuerySchema = z.object({
  panelId: z.string().optional(),
  ids: z.string().optional(),
  method: z.string().optional(),
  username: z.string().optional(),
  user_email: z.string().optional(),
  user_id: z.string().optional(),
  payment_status: z.string().optional(),
  ip_address: z.string().optional(),
  memo: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  mode: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return value;
    return Math.min(Math.max(Math.trunc(numeric), 1), 1000);
  }, z.number().int().min(1).max(1000).optional()),
  sort: z.string().optional(),
});

export const settingsSchema = z.object({
  highValueApprovalEnabled: z.boolean(),
  highValueApprovalThreshold: z.string().trim().min(1),
  highValueApprovalCurrency: z.string().trim().min(3).max(8),
  defaultPaymentMethod: z.string().trim().min(1).max(80),
  defaultMemo: z.string().trim().max(255),
  requireSecondConfirmAbove: z.string().trim().min(1),
});

export function normalizeBaseUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

export function adminApiUrl(baseUrl: string, path: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (normalized.endsWith("/adminapi/v2")) {
    return `${normalized}${suffix}`;
  }
  return `${normalized}/adminapi/v2${suffix}`;
}

export function rowFingerprint(row: Pick<PaymentRowInput, "panelId" | "username" | "amount" | "method" | "memo">): string {
  return [
    row.panelId,
    row.username.trim().toLowerCase(),
    row.amount.trim(),
    row.method.trim().toLowerCase(),
    (row.memo ?? "").trim().toLowerCase(),
  ].join("|");
}

export function validateRows(rows: PaymentRowInput[]): PreviewIssue[] {
  const issues: PreviewIssue[] = [];
  const seen = new Map<string, string>();

  rows.forEach((row) => {
    const parsed = paymentRowSchema.safeParse(row);
    if (!parsed.success) {
      issues.push({
        rowId: row.clientRowId,
        level: "error",
        code: "invalid_row",
        message: parsed.error.issues[0]?.message ?? "Invalid payment row",
      });
      return;
    }
    if (!parseAmount(row.amount)) {
      issues.push({
        rowId: row.clientRowId,
        level: "error",
        code: "invalid_amount",
        message: "Amount must be greater than zero",
      });
    }
    const fingerprint = rowFingerprint(row);
    const existing = seen.get(fingerprint);
    if (existing) {
      issues.push({
        rowId: row.clientRowId,
        level: "warning",
        code: "duplicate_row",
        message: `Duplicate of row ${existing}`,
      });
    } else {
      seen.set(fingerprint, row.clientRowId);
    }
  });

  return issues;
}

export function parseCsv(text: string): PaymentRowInput[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = ["panel", "panelid", "username", "amount"].some((key) => header.includes(key));
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows.map((line) => {
    const cells = splitCsvLine(line);
    const get = (names: string[], fallbackIndex: number) => {
      if (!hasHeader) return cells[fallbackIndex] ?? "";
      const idx = header.findIndex((name) => names.includes(name));
      return idx >= 0 ? (cells[idx] ?? "") : "";
    };
    return {
      clientRowId: crypto.randomUUID(),
      panelId: get(["panelid", "panel_id", "panel"], 0),
      username: get(["username", "user"], 1),
      amount: get(["amount"], 2),
      method: get(["method", "payment_method"], 3) || "Admin Credit",
      memo: get(["memo", "note"], 4) || undefined,
      affiliateCommission: ["1", "true", "yes"].includes(get(["affiliate", "affiliate_commission"], 5).toLowerCase()),
      currency: get(["currency"], 6) || undefined,
    };
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function toCsv(rows: Array<Record<string, string | number | boolean | null | undefined>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
