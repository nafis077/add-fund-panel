import { adminApiUrl } from "@/lib/validation";
import { redactValue } from "@/lib/redact";
import type {
  AddPaymentRequest,
  HistoryFilters,
  NormalizedAddPaymentResult,
  RemotePayment,
} from "@/types/domain";

export const ADD_PAYMENT_PATH = "/payments/add";
export const LIST_PAYMENTS_PATH = "/payments";
export const DEFAULT_RATE_LIMIT_RPS = 5;
export const MAX_HISTORY_PAGE = 1000;

export class PanelApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly outcome: NormalizedAddPaymentResult["outcome"] = "FAILED",
  ) {
    super(message);
    this.name = "PanelApiError";
  }
}

type FetchLike = typeof fetch;

export type PanelCredentials = {
  baseUrl: string;
  apiKey: string;
};

function headers(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Api-Key": apiKey,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickErrorCode(payload: Record<string, unknown>): number | null {
  const raw = payload.error_code ?? payload.errorCode ?? payload.error;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
    return Number(raw);
  }
  return null;
}

export function validateAddPaymentRequest(input: AddPaymentRequest): AddPaymentRequest {
  const username = input.username.trim();
  if (!username) throw new Error("username is required");
  if (!/^[A-Za-z0-9._-]+$/.test(username)) {
    throw new Error("username contains invalid characters");
  }
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("amount must be a number greater than zero");
  }
  const method = input.method.trim();
  if (!method) throw new Error("method is required");
  return {
    username,
    amount: input.amount,
    method,
    memo: input.memo?.trim() || undefined,
    affiliate_commission: Boolean(input.affiliate_commission),
  };
}

export function normalizeAddPaymentResponse(
  httpStatus: number,
  payload: unknown,
  submitted: boolean,
): NormalizedAddPaymentResult {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const errorCode = pickErrorCode(record) ?? pickErrorCode(data);
  const paymentId = pickString(
    data.id,
    data.payment_id,
    data.paymentId,
    record.id,
    record.payment_id,
    record.paymentId,
  );
  const errorMessage = pickString(
    record.error_message,
    record.errorMessage,
    record.message,
    data.error_message,
    data.message,
  );
  const balance = pickString(data.balance, data.user_balance, record.balance, record.user_balance);
  const currency = pickString(data.currency, record.currency);

  if (httpStatus === 429) {
    return {
      ok: false,
      outcome: "RATE_LIMITED",
      submitted,
      httpStatus,
      errorCode,
      errorMessage: errorMessage ?? "Panel rate limit exceeded",
      paymentId: null,
      balance,
      currency,
      rawRedacted: redactValue(payload),
    };
  }

  const confirmed = errorCode === 0 && Boolean(paymentId);
  if (confirmed) {
    return {
      ok: true,
      outcome: "SUCCESS",
      submitted,
      httpStatus,
      errorCode,
      errorMessage: null,
      paymentId,
      balance,
      currency,
      rawRedacted: redactValue(payload),
    };
  }

  return {
    ok: false,
    outcome: "FAILED",
    submitted,
    httpStatus,
    errorCode,
    errorMessage: errorMessage ?? "Panel rejected the payment",
    paymentId,
    balance,
    currency,
    rawRedacted: redactValue(payload),
  };
}

export function normalizeRemotePayment(value: unknown): RemotePayment | null {
  const record = asRecord(value);
  const id = pickString(record.id, record.payment_id, record.paymentId);
  if (!id) return null;
  return {
    id,
    username: pickString(record.username, record.user, asRecord(record.user).username),
    userEmail: pickString(record.user_email, record.email, asRecord(record.user).email),
    userId: pickString(record.user_id, record.userId, asRecord(record.user).id),
    amount: pickString(record.amount, record.price),
    currency: pickString(record.currency),
    method: pickString(record.method, record.payment_method),
    status: pickString(record.payment_status, record.status),
    memo: pickString(record.memo, record.note, record.comment),
    ipAddress: pickString(record.ip_address, record.ip),
    createdAt: pickString(record.created_at, record.created, record.date),
    balance: pickString(record.balance, record.user_balance),
  };
}

export function normalizePaymentList(payload: unknown): { items: RemotePayment[]; total: number | null } {
  const record = asRecord(payload);
  const data = record.data;
  const rawItems = Array.isArray(payload)
    ? payload
    : Array.isArray(data)
      ? data
      : Array.isArray(asRecord(data).list)
        ? (asRecord(data).list as unknown[])
        : Array.isArray(record.payments)
          ? record.payments
          : Array.isArray(record.list)
            ? record.list
            : [];
  const items = rawItems.map(normalizeRemotePayment).filter((item): item is RemotePayment => Boolean(item));
  const totalRaw = record.total ?? asRecord(data).total ?? record.count;
  const total = typeof totalRaw === "number" ? totalRaw : items.length;
  return { items, total };
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export async function addPanelPayment(
  credentials: PanelCredentials,
  input: AddPaymentRequest,
  options: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<NormalizedAddPaymentResult> {
  const body = validateAddPaymentRequest(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const fetchImpl = options.fetchImpl ?? fetch;
  let submitted = false;

  try {
    const response = await fetchImpl(adminApiUrl(credentials.baseUrl, ADD_PAYMENT_PATH), {
      method: "POST",
      headers: headers(credentials.apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    submitted = true;
    const payload = await readPayload(response);
    return normalizeAddPaymentResponse(response.status, payload, submitted);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      outcome: aborted || submitted ? "TIMEOUT" : "NETWORK",
      submitted,
      httpStatus: null,
      errorCode: null,
      errorMessage: aborted
        ? "Payment request timed out after submission may have reached the panel"
        : error instanceof Error
          ? error.message
          : "Network error",
      paymentId: null,
      balance: null,
      currency: null,
      rawRedacted: { error: "redacted" },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listPanelPayments(
  credentials: PanelCredentials,
  filters: HistoryFilters = {},
  options: { timeoutMs?: number; fetchImpl?: FetchLike } = {},
): Promise<{ items: RemotePayment[]; total: number | null; httpStatus: number }> {
  const params = new URLSearchParams();
  const limit = Math.min(filters.limit ?? 50, MAX_HISTORY_PAGE);
  const entries: Array<[string, string | number | undefined]> = [
    ["ids", filters.ids],
    ["method", filters.method],
    ["username", filters.username],
    ["user_email", filters.user_email],
    ["user_id", filters.user_id],
    ["payment_status", filters.payment_status],
    ["ip_address", filters.ip_address],
    ["memo", filters.memo],
    ["created_from", filters.created_from],
    ["created_to", filters.created_to],
    ["mode", filters.mode],
    ["offset", filters.offset ?? 0],
    ["limit", limit],
    ["sort", filters.sort],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${adminApiUrl(credentials.baseUrl, LIST_PAYMENTS_PATH)}?${params}`, {
      method: "GET",
      headers: headers(credentials.apiKey),
      signal: controller.signal,
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const message =
        pickString(asRecord(payload).error_message, asRecord(payload).message) ??
        `Payment history request failed (${response.status})`;
      throw new PanelApiError(message, response.status);
    }
    const list = normalizePaymentList(payload);
    return { ...list, httpStatus: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

export async function testPanelConnection(
  credentials: PanelCredentials,
  options: { fetchImpl?: FetchLike } = {},
): Promise<{ ok: boolean; message: string }> {
  try {
    await listPanelPayments(credentials, { limit: 1, offset: 0 }, { timeoutMs: 8000, fetchImpl: options.fetchImpl });
    return { ok: true, message: "Connected. Admin API accepted the key and returned payment history." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

export function buildInternalMemo(internalTxnId: string, memo?: string | null): string {
  const prefix = `[CFM:${internalTxnId}]`;
  const rest = memo?.trim();
  return rest ? `${prefix} ${rest}` : prefix;
}

export function extractInternalTxnId(memo: string | null | undefined): string | null {
  if (!memo) return null;
  const match = memo.match(/\[CFM:([A-Za-z0-9_-]+)\]/);
  return match?.[1] ?? null;
}
