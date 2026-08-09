# Besat frontend

This directory contains the Next.js 16 App Router frontend for the public site
and the role-based dashboards. Browser API calls use the same-origin
`/api/backend` route, which proxies to Django through `BESAT_BACKEND_API_URL`.

## Local run

Start Django on port 8000, then:

```powershell
Copy-Item .env.example .env.local
npm.cmd ci
npm.cmd run dev
```

The checked-in `.env.example` targets the local Django API. The optional
`mock://local` backend remains available for isolated UI development, but it is
not the default full-stack configuration.

## Checks

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run test:about:unit
npm.cmd run build
$env:PLAYWRIGHT_CHANNEL='chrome'; npm.cmd run test:e2e
```

The E2E command runs the main dashboard suite and then the dedicated About CMS
stub suite. `PLAYWRIGHT_CHANNEL` is optional when Playwright's bundled Chromium
is installed.

## Container runtime

Use the repository-level `docker-compose.yml`. The production image uses the
Next.js standalone output and runs as an unprivileged user. Inside Compose,
server-side and proxy requests use `http://backend:8000/api`; browsers continue
to call `/api/backend` on the frontend origin.
