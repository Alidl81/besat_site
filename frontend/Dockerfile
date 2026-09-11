FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund


FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --no-audit --no-fund


FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .

# NEXT_PUBLIC_SITE_URL is webpack-inlined at `next build` time and must be
# the real public origin. BESAT_BACKEND_API_URL is also evaluated at build
# time because it supplies the /media/* rewrite to Django. Both validators
# fail closed for missing, loopback, private, or placeholder values.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN node scripts/validate-production-site-url.mjs

ARG BESAT_BACKEND_API_URL
ENV BESAT_BACKEND_API_URL=$BESAT_BACKEND_API_URL
RUN node scripts/validate-production-backend-url.mjs

# The browser API base is intentionally a same-origin BFF path. Keep the
# validator in the build so an accidental future build ARG cannot ship an
# off-origin browser API endpoint.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN node scripts/validate-production-public-api-base.mjs

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --ingroup appgroup appuser

COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/.next ./.next
COPY --from=builder --chown=appuser:appgroup /app/public ./public
COPY --from=builder --chown=appuser:appgroup /app/package.json ./package.json
COPY --from=builder --chown=appuser:appgroup /app/next.config.ts ./next.config.ts

# The runtime never invokes npm. Removing its global CLI keeps the final
# image limited to the Next runtime and the production dependency tree.
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack

USER appuser

EXPOSE 3000

# Next's direct runtime command is the framework-specific equivalent of a
# node server.js exec-form command; it receives SIGTERM directly.
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]
