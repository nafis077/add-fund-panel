# Panel Treasury

Centralized multi-panel fund management for SMM X PANEL Admin API v2.

The original repository only contained this README. This application is the production fund-management module: administrators connect multiple SMM panels, review credits, and distribute funds through each panel's documented Admin API. Remote user balances are never changed by writing to a panel database.

## What it does

- Manage unlimited SMM panel connections (URL + encrypted Admin API key)
- Add funds for one user across many panels, or different users and amounts
- Import and export CSV bulk distributions
- Confirm every financial batch before execution
- Process payments in a durable background worker with per-panel concurrency and rate limits
- Keep an immutable local ledger, attempt log, and admin audit trail
- Pull remote payment history from `GET /adminapi/v2/payments` and link it to local operations
- Separate every financial total by currency

## Documented API contract

Credits use only:

- `POST {panelBaseUrl}/adminapi/v2/payments/add`
- `GET {panelBaseUrl}/adminapi/v2/payments`

Authentication header: `X-Api-Key: PANEL_API_KEY`

Add-funds body:

```json
{
  "username": "john",
  "amount": 12,
  "method": "Admin Credit",
  "memo": "Added from Central Fund Manager",
  "affiliate_commission": false
}
```

A payment is marked **Completed** only when the panel response has `error_code = 0` and a payment ID. Timeouts or dropped connections after submission are marked **Needs Verification** and are never auto-retried.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 App Router + TypeScript |
| Data | Prisma + SQLite locally, PostgreSQL on Railway |
| Auth | JWT httpOnly session, RBAC |
| Queue | Durable DB ledger with atomic claim (`QUEUED` → `PROCESSING`) |
| UI | Tailwind, existing dark treasury theme |

## Setup

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Default administrator from `.env`:

- Email: `admin@localhost`
- Password: `ChangeMeNow!`

Open [http://localhost:3000](http://localhost:3000).

Optional standalone worker:

```bash
npm run worker
```

The Next.js process also starts an in-process worker unless `DISABLE_INPROCESS_WORKER=1`.

## Permissions

| Role | Capabilities |
|---|---|
| `VIEWER` | View history and batches |
| `OPERATOR` | Create batches and retry safe failures |
| `ADMIN` | Manage panels, approve high-value batches, cancel queued work |
| `SUPER_ADMIN` | All of the above plus admin user management |

## Safety model

- API keys are AES-256-GCM encrypted and never returned to the browser
- Mutating routes check same-origin and require a session
- Duplicate browser submits reuse `clientSubmissionId`
- Completed payments cannot be retried
- Uncertain API outcomes require reconciliation against remote payment history
- High-value batches can require a second administrator

## Tests

```bash
npm test
```

Coverage includes single-user credits, multi-panel same-user and mixed-user batches, CSV validation, invalid input, API failures, partial success, duplicate submit, worker restart recovery, timeout verification, retry protection, pagination, currency totals, authorization, and audit events.

## Environment

See `.env.example`. `ENCRYPTION_KEY` must be a 32-byte secret (64 hex chars recommended). Never commit a production `.env`.

## Deploy on Railway

Railway needs **PostgreSQL**. Do not rely on SQLite there — Railway disks are ephemeral and a redeploy would wipe the payment ledger.

1. Push this branch to GitHub.
2. In [Railway](https://railway.app) create a new project → **Deploy from GitHub repo**.
3. Add a **PostgreSQL** plugin to the same project. Railway will inject `DATABASE_URL`.
4. In the web service **Variables**, set:

| Variable | Example |
|---|---|
| `AUTH_SECRET` | long random string (`openssl rand -base64 48`) |
| `ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`) |
| `ADMIN_EMAIL` | your login email |
| `ADMIN_PASSWORD` | a strong password, not `ChangeMeNow!` |
| `ADMIN_NAME` | `Treasury Admin` |
| `NEXT_PUBLIC_APP_NAME` | `Panel Treasury` |

Leave `DATABASE_URL` to the Postgres plugin. Do not paste a `file:` SQLite URL.

5. Settings that this repo already provides:
   - `railway.toml` start command: migrate → create admin if missing → `next start --hostname 0.0.0.0 --port $PORT`
   - Health check: `GET /api/health`
   - Node 22 via Nixpacks
6. Generate a public domain under **Settings → Networking → Generate Domain**.
7. Open the domain and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

The first boot runs `prisma migrate deploy` against Postgres and creates the admin user only if that email does not already exist. Later deploys will not reset the password.

If a Railway **Build image** step fails, check that the service builder is Nixpacks (this repo sets `builder = "NIXPACKS"`) and that install is not omitting devDependencies. The build needs TypeScript and Tailwind from `devDependencies`.
