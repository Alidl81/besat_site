# Role, Permission And Scope Matrix

The UI exposes exactly three panel families. Backend roles remain the source of
truth; this matrix describes the client routing and expected scope, not a
security boundary.

| Panel family | Backend roles | Landing route | Scope | Main capabilities |
|---|---|---|---|---|
| Admin | `general_manager`, `unit_manager` | `/dashboard/admin` | GM all units; UM assigned units | Dashboard, units when GM, students/staff/registrations in scope, approvals, reports/settings/users only for GM |
| Content manager | `unit_media` plus scoped content access | `/dashboard/content-manager` | Assigned unit(s) | Content drafts, news/announcements, media, albums, review queue, editorial calendar, messages and profile |
| Parent | `parent` | `/dashboard/parents` | Own account only | Dashboard, children only when a verified backend relation exists, supported programmes/registrations, messages and profile |

## Core Permissions

| Permission | General manager | Unit manager | Unit media | Parent |
|---|---:|---:|---:|---:|
| `dashboard.read` | Yes | Assigned unit | Assigned unit | Own account |
| `unit.manage` | All | Assigned unit | No | No |
| `student.manage` | All | Assigned unit | No | No |
| `registration.review` | All | Assigned unit | No | Own submitted requests only |
| `content.create` / `content.edit` | All | Assigned unit | Assigned unit | No |
| `content.review` | All | Assigned unit where backend permits | No | No |
| `content.publish` | Yes | No | No | No |
| `media.manage` | All | Assigned unit | Assigned unit | No |
| `user.manage` / `audit.read` | Yes | No | No | No |

## Enforcement

- `src/components/dashboard/dashboard-shell.tsx` filters visible admin routes
  by the display-safe session role and provides a forbidden state for hidden
  direct routes.
- `src/config/panel-access.ts` maps backend roles to one of the three panel
  families. There is no standalone user-facing unit-manager panel.
- Django verifies role and object scope for CMS, registration and parent data;
  hiding an item in the sidebar does not grant or revoke authority.
- Parent registration history is filtered by the authenticated requester,
  rather than supplied contact fields.
