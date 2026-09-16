FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Cles publiques necessaires au build (embarquees dans le bundle client).
# Les secrets (CLERK_SECRET_KEY, BACKEND_INTERNAL_URL) restent runtime-only.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_BACKEND_BASE
# Semver without leading v (e.g. 1.2.3). Empty = docs show releases-page fallback.
# Must match a real GitHub Release tag v* whose assets follow ferry-gateway-<ver>-<arch>.tar.gz.
ARG NEXT_PUBLIC_GATEWAY_RELEASE_VERSION=
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_BACKEND_BASE=$NEXT_PUBLIC_BACKEND_BASE \
    NEXT_PUBLIC_GATEWAY_RELEASE_VERSION=$NEXT_PUBLIC_GATEWAY_RELEASE_VERSION
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN useradd --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
