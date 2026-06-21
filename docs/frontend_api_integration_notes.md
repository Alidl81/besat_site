# Frontend API Integration Notes

## Base URL

Frontend reads API base URL from:

```txt
NEXT_PUBLIC_API_BASE_URL

Local default:

http://localhost:8000

Frontend example file:

frontend/.env.example
Required auth endpoints
GET /api/me/
GET /api/me/permissions/
GET /api/me/units/

The frontend needs these endpoints before activating real dashboard access.

Required dashboard endpoints
GET /api/dashboard/general-manager/
GET /api/dashboard/unit-manager/
GET /api/dashboard/media/
GET /api/dashboard/parents/

Expected dashboard response shape:

type DashboardResponse = {
  metrics: DashboardMetric[];
  requests: DashboardListItem[];
  activities: DashboardListItem[];
  announcements: DashboardListItem[];
};
Unit scoped content

Every unit can have its own:

news
announcements
gallery
events
messages
registration requests

Filtering pattern:

GET /api/content/?scope=unit&unit_id=1
GET /api/content/?scope=school
GET /api/content/?status=published

Important backend rule:

scope=unit requires unit_id
scope=school requires unit_id=null
Frontend files created
frontend/src/lib/api/client.ts
frontend/src/lib/api/endpoints.ts
frontend/src/types/api.ts
frontend/src/services/auth-service.ts
frontend/src/services/dashboard-service.ts
frontend/src/services/content-service.ts
frontend/.env.example

