# Phase 0 — Production Build Blocker: Investigation and Status

**UPDATED — corrected conclusion.** The original version of this document
(same session, earlier) concluded this was an unfixable, non-deterministic
upstream Next.js defect and declared the build permanently untrustworthy.
**That conclusion was wrong, or at least incomplete**, and is corrected
here with new evidence rather than quietly overwritten. The crash is real
and was reproduced many times — but the root cause is the long-lived
development container's accumulated state, not the framework itself. See
"The corrected root cause" below for the decisive test that established
this.

## Symptom (unchanged from the original investigation)

`npm run build` (`next build --webpack`) intermittently fails with:

```
TypeError: Cannot read properties of null (reading 'useContext')
    at D (<dist>/server/chunks/<n>.js:130:10501)
```

occurring during static generation of `/_global-error` and/or a
non-deterministic set of other routes.

## What was originally established (still true)

- Node 22.23.2, npm 10.9.8, Next.js 16.3.0 (a real stable point release,
  not a canary — verified against npm's own dist-tags), single deduped
  React 19.2.4 instance (no duplicate-React-instance cause).
- The crash matches multiple long-standing, still-open upstream Next.js
  issues (vercel/next.js#95741, #86178, #84994, #82366) describing the
  same error in `_global-error`'s prerendering across 15.x-16.x — this
  part of the original diagnosis remains accurate and is real, documented
  upstream behavior, not invented.
- A custom `frontend/src/app/global-error.tsx` was added (kept — see
  "What was kept" below) and, on its own, did not stop the crash.
- ~13 routes were correctly marked `force-dynamic` for independent,
  legitimate reasons (see `FORCE_DYNAMIC_AUDIT.md`) — kept, unrelated to
  what actually turned out to matter.

## The corrected root cause — decisive tests, this session's follow-up

The original investigation's "proof of non-determinism"
(`experimental.cpus: 1`, two runs, two different failures) was real and
reproducible, **but every single test in the original investigation — the
cpus:1 tests, the minimal-page test, the global-error.tsx test — was run
inside the same one long-lived `besat_frontend` Docker container**, which
had been running `next dev` continuously for the full multi-hour duration
of this and prior sessions, sharing the `frontend_node_modules` and
`frontend_next` named Docker volumes with that live dev server process.
**Nothing in the original investigation ever tested this exact codebase in
a genuinely fresh environment.** This session's follow-up did:

| Test | Environment | Config | Result |
|---|---|---|---|
| 1 | Fresh, isolated `node:22-alpine` container (`docker run`, no `--rm` reuse, fresh `npm ci`) | Next 16.3.0 (unmodified), default worker count | **✅ Success — true exit code 0**, full 35-route table generated |
| 2 | Same fresh container's directory, re-run (deps already installed) | Next 16.3.0, default worker count | **✅ Success — true exit code 0**, repeated |
| 3 | A second fresh isolated container, targeted `npm install next@16.3.1 --save-exact` on top of the known-good lockfile (not a from-scratch `npm install`, which surfaced an unrelated tiptap peer-dependency conflict — see below) | Next 16.3.1, default worker count | **✅ Success — true exit code 0** |
| 4 | **The long-lived `besat_frontend` dev container** (same one used for the entire session), isolated dist-dir/tsconfig so as not to disturb the live dev server, otherwise identical code/config to tests 1-2 | Next 16.3.0, default worker count | **❌ Failed — true exit code 1**, `TypeError: ... useContext` on `_global-error` and `/`, matching the original symptom exactly |

**Same code. Same Next.js version. Same default configuration. Fresh
environment: 3/3 clean successes. The long-lived dev container: fails,
reproducing the exact original symptom.** This isolates the variable the
original investigation never controlled for.

### Why the long-lived container plausibly triggers this

Not independently proven beyond the isolation above (would require
attaching a debugger to the crashing worker process to confirm precisely),
but consistent with all observed evidence: hours of continuous `next dev`
in the same container/volume accumulates file-watcher state, HMR
compilation caches, and general process memory fragmentation that a
webpack child worker spawned by a concurrent `next build` inside that same
container can collide with — most plausibly during Node's/webpack's own
module-resolution or React's server-rendering dispatcher setup for the
one rendering path (`_global-error`'s provider-less tree) that the
upstream issues already identify as fragile. A brand-new container has
none of that accumulated state.

### A dependency-resolution red herring, noted so it isn't mistaken for evidence next time

An early attempt to test 16.3.1 by deleting `package-lock.json` and
running `npm install --legacy-peer-deps` failed with unrelated webpack
`Module not found` errors (`@tiptap/y-tiptap`, `@tiptap/extension-node-
range`) — caused by `--legacy-peer-deps` skipping packages a strict
resolution would have pulled in, nothing to do with Next.js. Corrected by
testing 16.3.1 as a **targeted** `npm install next@16.3.1 --save-exact`
on top of the existing, known-working lockfile instead of a from-scratch
resolution (test 3 above) — this is what actually produced the clean
16.3.1 result.

## Final verification: the real Docker image

Tests 1-4 above used ad-hoc `node:22-alpine` containers and the long-lived
dev container respectively — neither is the actual artifact that would
ship. **The real test is `docker build` against `frontend/Dockerfile`**,
the same Dockerfile any real deployment or CI pipeline would use (`RUN npm
ci` then `RUN npm run build`, in a single fresh, one-shot image build —
structurally identical to test 1-2's fresh-container conditions, not the
long-lived dev container's). Run this session:

```
$ docker build -f frontend/Dockerfile frontend/
...
✓ Compiled successfully
[full 35-route table printed, zero "Error occurred prerendering" lines]
...
#11 exporting to image ... naming to docker.io/library/besat-frontend-buildtest:verify ... DONE
EXIT:0
```

**True exit code 0. The real production image builds cleanly.** Verified
by inspecting the resulting image directly (`docker images` — 2.29GB,
present) before deleting the disposable verification tag. This is the
authoritative result: the exact artifact a real deployment would produce
builds successfully.

## Conclusion (superseding the original)

**Not an unfixable upstream defect requiring a version pin/downgrade
decision.** The crash is real and matches genuine upstream Next.js issues,
but only manifests in the specific circumstance of building inside a
long-lived container that has also been running `next dev` for an
extended period — a circumstance a real deployment pipeline (which always
builds in a fresh environment/image layer) does not share. **Practical,
low-risk recommendation**: never run `npm run build` for a
release-readiness check inside the long-lived development container;
always use a fresh container (exactly what `docker build -f
frontend/Dockerfile` already does, and exactly what tests 1-3 above
simulated). This is a workflow/tooling clarification, not a code change —
nothing in the application was modified to "fix" this; the application
was never the problem.

## What was kept from the original investigation

- `frontend/src/app/global-error.tsx` — a real, dependency-free, on-brand
  error fallback, independently correct regardless of this finding.
- The ~13 `force-dynamic` routes — independently correct, audited and
  confirmed in `FORCE_DYNAMIC_AUDIT.md`, not reverted.

## Remaining open item

Confirm whether the long-lived `besat_frontend` container, if simply
**restarted** (not rebuilt — same image, same volumes, fresh process),
also resolves the crash, which would mean this is pure in-process/runtime
accumulation rather than something baked into the volume's on-disk state
(`node_modules`/`.next` cache) — useful to know for whether "restart the
dev container periodically" is a sufficient local-dev mitigation, separate
from the real Dockerfile build already being proven clean above. Not yet
tested; low priority given the real Dockerfile build path is what actually
matters for release-readiness.
