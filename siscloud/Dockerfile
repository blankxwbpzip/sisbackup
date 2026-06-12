# Siscloud - Production Docker Image
# Target: Linux (Ubuntu 24.04 LTS)

FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ─── Dependencies ────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --production --ignore-scripts && npm cache clean --force

# ─── Prisma Client ───────────────────────────────────────
FROM base AS builder
COPY prisma ./prisma
COPY package.json ./
RUN npm ci && npx prisma generate

# ─── Final Image ─────────────────────────────────────────
FROM base
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system siscloud && adduser --system --ingroup siscloud siscloud

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

RUN chown -R siscloud:siscloud /app
USER siscloud

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "node_modules/.bin/next", "start"]
