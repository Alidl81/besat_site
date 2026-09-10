// OPS-FE-PUBLIC-API-BASE-001: NEXT_PUBLIC_API_BASE_URL is webpack-inlined
// into every browser bundle at `next build` time, exactly like
// NEXT_PUBLIC_SITE_URL (see validate-production-site-url.mjs) -- a runtime
// check inside the resolver that reads it (src/lib/api/client.ts) can
// reject an already-poisoned value once code runs, but cannot stop a
// misconfigured/poisoned build from shipping in the first place. Unlike
// NEXT_PUBLIC_SITE_URL/BESAT_BACKEND_API_URL, this value is a fixed,
// same-origin BFF proxy route in every topology this project currently
// supports (see frontend/.env.production.example) -- never a per-
// deployment absolute origin -- so any non-relative or off-origin value
// is always wrong, not just wrong for one deployment's topology.
//
// OPS-FE-PUBLIC-API-BASE-001-R1: an omitted Docker ARG becomes an EMPTY
// STRING once assigned to ENV in frontend/Dockerfile (`ARG X` + `ENV
// X=$X` with no --build-arg resolves `$X` to "", not "unset") -- not
// `undefined`. This is exactly the current state of every build using
// this Dockerfile today, since no compose file wires this ARG through.
// `?.trim()` + a truthy check (matching validate-production-backend-url.mjs's
// own `const raw = process.env.BESAT_BACKEND_API_URL?.trim(); if (!raw)`
// convention) treats that empty string the same as genuinely unset,
// instead of treating it as an explicit "" override and failing the build.
const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

function fail(reason) {
  console.error(
    `NEXT_PUBLIC_API_BASE_URL is invalid for a production build: ${reason}\n` +
      `Leave it unset (defaults to "/api/backend") or set it only if you have deliberately restructured the BFF proxy's own route path (see frontend/.env.production.example).`,
  );
  process.exit(1);
}

if (raw) {
  const SAFE_RESOLUTION_BASE = "https://besat-internal-url-safety-check.invalid";
  const looksRelative =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") && !raw.includes("\\");

  if (!looksRelative) {
    fail(`"${raw}" is not a same-origin relative path.`);
  }

  let resolved;
  try {
    resolved = new URL(raw, SAFE_RESOLUTION_BASE);
  } catch {
    fail(`"${raw}" could not be parsed as a relative path.`);
  }
  if (resolved.origin !== SAFE_RESOLUTION_BASE) {
    fail(`"${raw}" resolves off-origin once parsed.`);
  }
}

console.log(`NEXT_PUBLIC_API_BASE_URL is valid: ${raw || "(unset, using default /api/backend)"}`);
