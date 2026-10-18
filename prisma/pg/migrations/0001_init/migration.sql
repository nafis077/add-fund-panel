-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyLast4" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "connectionStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "concurrencyLimit" INTEGER NOT NULL DEFAULT 2,
    "minRequestIntervalMs" INTEGER NOT NULL DEFAULT 250,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL,
    "highValueApprovalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "highValueApprovalThreshold" TEXT NOT NULL DEFAULT '1000',
    "highValueApprovalCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'Admin Credit',
    "defaultMemo" TEXT NOT NULL DEFAULT 'Added from Central Fund Manager',
    "requireSecondConfirmAbove" TEXT NOT NULL DEFAULT '5000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflow" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "clientSubmissionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "panelSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentBatchPanel" (
    "batchId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,

    CONSTRAINT "PaymentBatchPanel_pkey" PRIMARY KEY ("batchId","panelId")
);

-- CreateTable
CREATE TABLE "PaymentOperation" (
    "id" TEXT NOT NULL,
    "internalTxnId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "memo" TEXT,
    "affiliateCommission" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "rowFingerprint" TEXT NOT NULL,
    "clientRowId" TEXT NOT NULL,
    "remotePaymentId" TEXT,
    "remoteBalance" TEXT,
    "remoteCurrency" TEXT,
    "errorMessage" TEXT,
    "executionMs" INTEGER,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "claimExpiresAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastAttemptOutcome" TEXT,
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL,
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "httpStatus" INTEGER,
    "errorCode" TEXT,
    "remotePaymentId" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "redactedResponse" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "batchId" TEXT,
    "metadata" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Panel_isActive_idx" ON "Panel"("isActive");
CREATE INDEX "Panel_name_idx" ON "Panel"("name");
CREATE UNIQUE INDEX "PaymentBatch_clientSubmissionId_key" ON "PaymentBatch"("clientSubmissionId");
CREATE INDEX "PaymentBatch_status_createdAt_idx" ON "PaymentBatch"("status", "createdAt");
CREATE INDEX "PaymentBatch_createdById_idx" ON "PaymentBatch"("createdById");
CREATE UNIQUE INDEX "PaymentOperation_internalTxnId_key" ON "PaymentOperation"("internalTxnId");
CREATE UNIQUE INDEX "PaymentOperation_batchId_clientRowId_key" ON "PaymentOperation"("batchId", "clientRowId");
CREATE INDEX "PaymentOperation_status_panelId_claimedAt_idx" ON "PaymentOperation"("status", "panelId", "claimedAt");
CREATE INDEX "PaymentOperation_batchId_status_idx" ON "PaymentOperation"("batchId", "status");
CREATE INDEX "PaymentOperation_username_idx" ON "PaymentOperation"("username");
CREATE INDEX "PaymentOperation_remotePaymentId_idx" ON "PaymentOperation"("remotePaymentId");
CREATE INDEX "PaymentOperation_rowFingerprint_idx" ON "PaymentOperation"("rowFingerprint");
CREATE INDEX "PaymentAttempt_operationId_startedAt_idx" ON "PaymentAttempt"("operationId", "startedAt");
CREATE INDEX "PaymentAuditLog_entityType_entityId_createdAt_idx" ON "PaymentAuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "PaymentAuditLog_action_createdAt_idx" ON "PaymentAuditLog"("action", "createdAt");
CREATE INDEX "PaymentAuditLog_createdAt_idx" ON "PaymentAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentBatchPanel" ADD CONSTRAINT "PaymentBatchPanel_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentBatchPanel" ADD CONSTRAINT "PaymentBatchPanel_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentOperation" ADD CONSTRAINT "PaymentOperation_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "PaymentOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
