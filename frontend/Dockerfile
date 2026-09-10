FROM node:22-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# OPS-FRONTEND-BUILD-ORIGIN-001: NEXT_PUBLIC_SITE_URL is webpack-inlined at
# `next build` time everywhere it's referenced (root layout.tsx's
# metadataBase, used by every statically-prerendered page's canonical/OG
# metadata) -- it is NOT a fixed same-origin path like
# NEXT_PUBLIC_API_BASE_URL below, it's the real public domain and differs
# per deployment. Without this ARG, it silently fell back to its
# development default (http://localhost:3000) baked permanently into the
# image regardless of what frontend/.env.production supplies at container
# start (that env_file is only applied at `docker compose up`, long after
# this image was built). See frontend/.env.production.example and
# docker-compose.prod.yml's frontend.build.args for how operators supply
# this value. Fails the build outright (OPS-PROD-DOC-DRIFT-001's
# recommended fail-closed preflight) if it's missing, non-https://,
# loopback/private, or an unedited template placeholder -- see
# scripts/validate-production-site-url.mjs.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN node scripts/validate-production-site-url.mjs

# OPS-FRONTEND-MEDIA-REWRITE-001: next.config.ts's `/media/*` rewrite
# (Django serves uploaded product/gallery/news/tour files there; Next has
# no route of its own for that path) is computed from
# process.env.BESAT_BACKEND_API_URL when next.config.ts is evaluated --
# and for a production build, that evaluation happens once, during this
# `RUN npm run build` step, with the result serialized into the build
# output's routes manifest. `next start` reads that manifest rather than
# re-running rewrites() later, so a value only supplied at container
# runtime (via docker-compose.prod.yml's frontend.env_file) can never
# reach an already-built image. Without this ARG, the rewrite was silently
# omitted from every production image -- every `/media/...` request
# returned a Next.js 404 before ever reaching Django. Fails the build
# outright rather than silently shipping an image with no rewrite.
#
# The validation itself is a real Node script (scripts/validate-
# production-backend-url.mjs), not a shell `case` pattern -- a first
# attempt using plain string matching only caught the literal substrings
# "127.0.0.1"/"localhost" and missed IPv6 loopback, the unspecified
# address, link-local addresses, the cloud metadata-service address, and
# raw RFC1918 private IPs (which bypass this compose topology's own DNS
# service discovery and aren't guaranteed stable across restarts) --
# proper IP-range checks need real parsing, which POSIX shell string
# globs can't reliably do.
ARG BESAT_BACKEND_API_URL
ENV BESAT_BACKEND_API_URL=$BESAT_BACKEND_API_URL
RUN node scripts/validate-production-backend-url.mjs

# OPS-FE-PUBLIC-API-BASE-001: NEXT_PUBLIC_API_BASE_URL is also webpack-
# inlined into every browser bundle at this same `npm run build` step. No
# compose file in this repo currently passes this as a build ARG (it has
# one fixed, documented-safe default -- see frontend/.env.production.example
# -- and is not meant to vary per deployment), so today this ARG is always
# empty and the check below always passes trivially. It exists so that if
# this var is ever wired through as a build ARG in the future (mirroring
# the two ARGs above), a value that isn't the documented same-origin BFF
# path fails this build immediately instead of silently shipping an image
# whose browser bundle sends API/invitation-token requests off-origin.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN node scripts/validate-production-public-api-base.mjs

RUN npm run build

# The build step above needs devDependencies (TypeScript, ESLint plugins,
# Tailwind's build-time packages, etc.); `next start` at runtime does not.
# Left in place, they were dead weight shipped in every image and the
# source of every frontend finding in a container vulnerability scan (see
# docs/security/DEPENDENCY_SECURITY.md) -- none exploitable (never
# executed at runtime), but "not shipped at all" is strictly safer than
# "shipped but allegedly inert", and this is free: prune, don't reinstall,
# no next.config.ts change (deliberately not switching to `output:
# "standalone"` here -- that's a real config change and, given how fragile
# this exact build pipeline has already proven to be this session, not
# worth the added surface without a full separate re-verification pass).
RUN npm prune --omit=dev

# `npm prune` only touches this project's own node_modules. The base
# image also ships its own copy of npm's CLI (and npm's *own* vendored
# dependencies -- tar, sigstore, ip-address, brace-expansion, picomatch --
# under /usr/local/lib/node_modules/npm/node_modules) so that `npm ci`/
# `npm run build` work above. Once the build has finished, nothing in this
# image runs `npm` again: CMD below invokes the `next` binary directly.
# Deleting npm's own install here removed the last remaining container-scan
# findings (verified via Trivy re-scan, see docs/security/
# DEPENDENCY_SECURITY.md) without touching anything the app itself needs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]