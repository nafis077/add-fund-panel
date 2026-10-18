FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NPM_CONFIG_PRODUCTION=false
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY scripts ./scripts
RUN npm ci --include=dev --ignore-scripts
RUN node scripts/prisma-generate.mjs

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_PRODUCTION=false
ENV PRISMA_SCHEMA=postgresql
ENV DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV PRISMA_SCHEMA=postgresql
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start:railway"]
