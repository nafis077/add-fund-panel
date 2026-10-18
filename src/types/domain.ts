export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = [
  "panels.manage",
  "payments.view",
  "payments.create",
  "payments.approve",
  "payments.retry",
  "payments.cancel",
  "settings.manage",
  "admins.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const OPERATION_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "NEEDS_VERIFICATION",
  "CANCELLED",
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const BATCH_STATUSES = [
  "PENDING_APPROVAL",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
  "CANCELLED",
] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const CONNECTION_STATUSES = ["UNKNOWN", "CONNECTED", "FAILED"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const ATTEMPT_OUTCOMES = [
  "SUCCESS",
  "FAILED",
  "RATE_LIMITED",
  "TIMEOUT",
  "NETWORK",
  "UNKNOWN",
] as const;
export type AttemptOutcome = (typeof ATTEMPT_OUTCOMES)[number];

export const REMOTE_PAYMENT_STATUSES = [
  "waiting",
  "completed",
  "pending",
  "fail",
  "expired",
  "hold",
  "underpaid",
] as const;
export type RemotePaymentStatus = (typeof REMOTE_PAYMENT_STATUSES)[number];

export const WORKFLOWS = ["SAME_USER", "MIXED_ROWS"] as const;
export type Workflow = (typeof WORKFLOWS)[number];

export type CurrencyTotals = Record<string, string>;

export type PaymentRowInput = {
  clientRowId: string;
  panelId: string;
  username: string;
  amount: string;
  method: string;
  memo?: string;
  affiliateCommission?: boolean;
  currency?: string;
};

export type PreviewIssue = {
  rowId: string;
  level: "error" | "warning";
  code: string;
  message: string;
};

export type AddPaymentRequest = {
  username: string;
  amount: number;
  method: string;
  memo?: string;
  affiliate_commission: boolean;
};

export type NormalizedAddPaymentResult = {
  ok: boolean;
  outcome: AttemptOutcome;
  submitted: boolean;
  httpStatus: number | null;
  errorCode: number | null;
  errorMessage: string | null;
  paymentId: string | null;
  balance: string | null;
  currency: string | null;
  rawRedacted: unknown;
};

export type RemotePayment = {
  id: string;
  username: string | null;
  userEmail: string | null;
  userId: string | null;
  amount: string | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  memo: string | null;
  ipAddress: string | null;
  createdAt: string | null;
  balance: string | null;
};

export type HistoryFilters = {
  ids?: string;
  method?: string;
  username?: string;
  user_email?: string;
  user_id?: string;
  payment_status?: string;
  ip_address?: string;
  memo?: string;
  created_from?: string;
  created_to?: string;
  mode?: string;
  offset?: number;
  limit?: number;
  sort?: string;
};
