FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

# Switch to PostgreSQL schema for production build
COPY deploy/prisma.schema.postgresql prisma/schema.prisma
RUN npx prisma generate
RUN npm run build

# ── Production ────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/pdfkit ./node_modules/pdfkit
COPY --from=deps /app/node_modules/fontkit ./node_modules/fontkit
COPY --from=deps /app/node_modules/png-js ./node_modules/png-js
COPY --from=deps /app/node_modules/@noble ./node_modules/@noble
COPY --from=deps /app/node_modules/fflate ./node_modules/fflate
COPY --from=deps /app/node_modules/linebreak ./node_modules/linebreak
COPY --from=deps /app/node_modules/@swc ./node_modules/@swc
COPY --from=deps /app/node_modules/brotli ./node_modules/brotli
COPY --from=deps /app/node_modules/clone ./node_modules/clone
COPY --from=deps /app/node_modules/dfa ./node_modules/dfa
COPY --from=deps /app/node_modules/fast-deep-equal ./node_modules/fast-deep-equal
COPY --from=deps /app/node_modules/restructure ./node_modules/restructure
COPY --from=deps /app/node_modules/tiny-inflate ./node_modules/tiny-inflate
COPY --from=deps /app/node_modules/unicode-properties ./node_modules/unicode-properties
COPY --from=deps /app/node_modules/unicode-trie ./node_modules/unicode-trie

# Upload directory
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
