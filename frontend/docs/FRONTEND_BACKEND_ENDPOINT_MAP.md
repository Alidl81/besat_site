# Besat frontend-to-backend endpoint map

Audited against backend branch `backend/mvp-bootstrap` at
`ea5860fec717e0cc37d4fc1d16a4938adef1a917`, plus the scoped backend changes
in this delivery.

## Conventions

- Backend base URL is server-only `BESAT_BACKEND_API_URL`; browser requests use
  same-origin `/api/backend/`. No credential belongs in `NEXT_PUBLIC_*`.
- Every backend path below has a required trailing slash. The Next proxy keeps
  it (`skipTrailingSlashRedirect: true`).
- Roles: `GM` general manager, `UM` unit manager, `MO` unit media officer,
  `PA` parent.
- Browser sessions use HttpOnly, SameSite=Lax `besat_access` and
  `besat_refresh` cookies issued only by the Next server. Browser JavaScript
  never receives either JWT. The BFF injects the access token upstream and
  retries one failed request after a successful token refresh.
- Standard lists use `{count,next,previous,results}` and accept `page`.
  Endpoints marked "array" or "object" are not paginated.
- Standard DRF failures are `{detail}` for authentication/permission/not-found,
  or `{field: [messages]}` for validation. The proxy adds a stable 502 shape
  `{detail,code:"upstream_unavailable",request_id}`.
- Dates are `YYYY-MM-DD`; datetimes are ISO 8601. Public content is active,
  `published`, and `published_at <= today`; a future publication is hidden.

## Public API

| Domain | Method and exact path | Auth | Query / request | Response and filtering |
|---|---|---:|---|---|
| Site | `GET /api/site-settings/` | No | None | Object; official identity/contact/hero fields |
| Home | `GET /api/home/` | No | None | Object; settings, active slides/units and published content |
| Home slides | `GET /api/home/slides/` | No | None | Array of active ordered slides |
| About | `GET /api/about/` | No | None | Object; introduction/history/founders/key people/mission/values/goals/images/video metadata |
| Contact info | `GET /api/contact/` | No | None | Object; complex contact record |
| Units | `GET /api/units/`, `GET /api/units/{slug}/` | No | `search`, `ordering` | Active unit array/detail; includes contact fields and `accepts_registration` |
| Departments | `GET /api/departments/`, `GET /api/departments/{slug}/` | No | `search`, `ordering`, `page` | Published department list/detail |
| News | `GET /api/news/`, `GET /api/news/{slug}/` | No | `search`, `ordering`, `scope=school|unit`, `unit_id`, category slug `category`, `featured`, `important` | Paginated/detail; published only; includes category/unit, image, featured, important, priority |
| News categories | `GET /api/news/categories/` | No | None | Active category array |
| Announcements | `GET /api/announcements/`, `GET /api/announcements/{slug}/` | No | `search`, `ordering`, `scope`, `unit_id`, category slug `category`, `featured` | Paginated/detail; published only |
| Achievements | `GET /api/achievements/`, `GET /api/achievements/{slug}/` | No | `search`, `ordering`, `unit_id`, `featured` | Independent achievement model/list/detail; active and publication-date filtered |
| Gallery | `GET /api/gallery/`, `GET /api/gallery/{slug}/` | No | `search`, `ordering`, `scope`, `unit_id`, `album`, `date_from`, `date_to`, `featured`, `page` | Paginated/detail; published only. No backend category or media-type filter exists |
| Events | `GET /api/events/`, `GET /api/events/{slug}/` | No | `search`, `ordering`, `page` | Published event list/detail |
| Staff | `GET /api/staff/`, `GET /api/staff/{slug}/` | No | `search`, `ordering`, `page` | Active public staff list/detail |
| Registration info | `GET /api/registration/` | No | None | Object with open/closed state, instructions and documents |
| Pre-registration | `POST /api/registration-requests/` | No, throttled | JSON: `student_full_name` (alias `full_name`), `parent_full_name?`, `parent_phone`, `parent_email?`, `requested_unit` (alias `unit_id`), `requested_grade`, `description?` | 201 created record; validates active/existing unit, unit registration state and global registration state |
| Contact message | `POST /api/messages/` | No, throttled | JSON: `full_name` (alias `name`), `phone?`, `email?`, `subject`, `message`, `related_unit?`, `message_type` | 201; phone or email required, message >=10 chars, active unit required |

The backend has no separate `is_hot` field. The news slider treats
`is_featured`, `is_important`, or a positive backend `priority` as slider
eligibility, then deduplicates records from the important and unit sections.

`message_type` values are `general`, `criticism`, `suggestion`, `complaint`,
and `feedback`. No sensitive form value is persisted in browser storage.

## Authentication and panel context

| Method and exact path | Auth / role | Contract |
|---|---|---|
| `POST /api/auth/login/` | No | `{username,password}` -> `{access,refresh,user}` |
| `POST /api/auth/refresh/` | Refresh token | `{refresh}` -> rotated `{access,refresh}` |
| `POST /api/auth/logout/` | Access token | `{refresh}`; 204 empty response |
| `GET /api/me/` | Any active user | Current user and role |
| `GET /api/me/permissions/` | Any active user | Permission key array/object |
| `GET /api/me/units/` | Any active user | Role-scoped unit array |
| `GET/PATCH /api/me/profile/` | Any active user | Profile read/update |
| `POST /api/me/profile/avatar/` | Any active user | Multipart field `avatar` |
| `POST /api/me/change-password/` | Any active user | `{current_password,new_password}` |
| `GET /api/dashboard/context/` | Any active user | `unit` or `unit_id`; user, scoped units, selected unit, unread counts. Academic years/children are empty because no models exist |
| `GET /api/dashboard/general-manager/` | GM | Global cards/status/activity |
| `GET /api/dashboard/unit-manager/` | GM/UM | `unit_id`; own-unit cards/status/activity |
| `GET /api/dashboard/media/` | GM/UM/MO | `unit_id`; own-unit gallery/media status |
| `GET /api/dashboard/parents/` | PA | Parent profile and related unit count only |

### Browser session facade

The browser calls these same-origin Next routes. They are not Django routes and
keep JWT values out of browser storage.

| Method and exact path | Upstream consumer | Contract |
|---|---|---|
| `POST /api/session/` | `POST /api/auth/login/` | Receives `{username,password}`, sets HttpOnly access/refresh cookies, returns only display-safe user data |
| `GET /api/session/` | `GET /api/me/` | Current display-safe user/session context from the access cookie |
| `DELETE /api/session/` | `POST /api/auth/logout/` | Sends refresh server-side, clears local HttpOnly cookies, returns 204 |
| `ANY /api/backend/{path}` | Matching `/api/{path}/` | BFF normalizes the trailing slash, blocks cross-origin mutations, strips browser cookies, injects server-side authorization, and emits a stable upstream-unavailable error |

## Management API

| Domain | Exact paths | Methods | Roles and scoping |
|---|---|---|---|
| Unified editor | `/api/cms/content/`, `/api/cms/content/{news-N|announcement-N}/` | GET list/detail; POST; PATCH; DELETE | Published reads are public; authenticated writes; GM global, UM/MO own units |
| Unified workflow | `/api/cms/content/{id}/submit-review/`, `approve/`, `reject/`, `schedule/`, `publish/` | POST | UM/MO submit; GM/UM approve/reject within scope; GM schedule/publish |
| Revisions | `/api/cms/content/{id}/revisions/`, `/api/cms/content/{id}/revisions/{revision_id}/restore/` | GET; POST restore | Scoped write access. Returns actor, timestamp, note and raw document snapshot; restore reuses backend workflow permissions |
| Native news | `/api/cms/news/`, `/api/cms/news/{id}/` | GET/POST/PATCH/DELETE | GM global; UM own units; MO read and image upload |
| News workflow | `/api/cms/news/{id}/{submit-review|approve|reject|archive|restore|publish}/` | POST | UM submit/review own unit; GM all; publish GM only |
| News image | `/api/cms/news/{id}/upload-image/` | POST multipart `image` | GM/UM/MO in scope |
| Native announcements | `/api/cms/announcements/`, `/api/cms/announcements/{id}/` | GET/POST/PATCH/DELETE | Same native role rules as news |
| Announcement workflow/image | `/api/cms/announcements/{id}/{action}/`, `/upload-image/` | POST | Same transition roles; upload multipart `image` |
| Gallery items | `/api/cms/gallery/`, `/api/cms/gallery/{id}/` | GET/POST/PATCH/DELETE | GM global; UM/MO own units |
| Gallery workflow | `/api/cms/gallery/{id}/{submit-review|approve|reject|archive|restore|publish}/` | POST | MO may submit; UM/GM review; publish GM only |
| Media library | `/api/cms/media/`, `/api/cms/media/{id}/` | GET/POST/DELETE | GM global; UM/MO scoped; uploader/UM/GM delete rules; list supports `page`, `page_size`, `unit`, `media_type`, `search`, and `ordering` |
| Achievements | `/api/cms/achievements/`, `/api/cms/achievements/{id}/` | GET/POST/PATCH/DELETE | GM only; independent from news |
| Static pages | `/api/cms/static-pages/`, `/api/cms/static-pages/{id}/` | GET/POST/PATCH/DELETE | GM-managed CMS pages including About fields |
| Units/departments | `/api/cms/units/`, `/api/cms/departments/` and `{id}/` | CRUD | Units authenticated with non-GM active-only visibility; department mutation GM |
| Home slides | `/api/cms/home-slides/`, `/api/cms/home-slides/{id}/` | CRUD | GM |
| Contact inbox | `/api/cms/messages/`, `/api/cms/messages/{id}/` | GET/PATCH/DELETE | GM; `search`, `status`, `ordering`, `page` |
| Registrations | `/api/cms/registration-requests/`, `{id}/` | GET/PATCH/DELETE | GM all; UM own units; `search`, `status`, `unit_id`, `ordering`, `page` |
| Students | `/api/cms/students/`, `{id}/` | CRUD | GM/UM own units; PA and MO denied |
| Staff/programs/classes | `/api/cms/staff/`, `/programs/`, `/classes/` and `{id}/` | CRUD | Backend-defined GM/UM scope; unsupported navigation is hidden |
| Users/access | `/api/cms/users/`, `/api/cms/users/{id}/` | CRUD | GM only |
| Internal messages | `/api/cms/internal-messages/`, `{id}/`, `{id}/mark-read/`, `recipients/` | GET/POST/PATCH/DELETE; POST mark; GET recipients | Authenticated; queryset and object access limited to sender/recipient/role broadcast; recipients unit-scoped |

Native CMS lists accept `search`, `ordering`, `page`, plus domain fields such
as `status`, `scope`, `unit_id`, and `category` where implemented.

## Editor and upload payloads

Unified content accepts `kind`, `title`, `summary`, `body_html`, `body_json`,
`cover_image_url`, `scope`, `unit_id`, `category`, `status`, `published_at`,
and `is_featured`. `body_json` is the lossless editable Tiptap source. The
backend stores it in `editor_json`, keeps the legacy Editor.js representation
for compatibility, and renders safe public HTML from the raw document.

`GET /api/cms/media/` is paginated and supports `unit`, `media_type`, `search`,
`ordering`, `page`, and `page_size`. `POST /api/cms/media/` is multipart with
required `file` and optional `title`, `alt_text`, `caption`, `unit`. Allowed MIME
types are JPEG, PNG, WebP, GIF, MP4, WebM and Ogg; maximum size is 25 MiB.
Response includes `id`, absolute `url`, derived `media_type`, `content_type`,
`size`, unit and timestamps.

Workflow order is:
`draft -> waiting_review -> approved -> scheduled/published`, with
`waiting_review|approved -> rejected` and `rejected -> waiting_review`.
Scheduled content uses backend status `published` plus a future
`published_at`; the compatibility response reports `scheduled`, and public
queries exclude it until its date.

## Endpoint-to-frontend consumer map

| Frontend consumer | Backend domains |
|---|---|
| `src/services/public-content-service.ts` | public site, units, news, announcements, achievements, gallery, about, contact and registration |
| `src/services/panel-service.ts` | dashboard context, CMS content/workflow/revisions, media, galleries, users, registrations and internal messages |
| `src/lib/auth/login-service.ts` and `src/lib/auth/auth-session.ts` | `/api/session/` only; no client bearer token storage |
| `src/components/dashboard/editorial-workspace.tsx` | unified content, workflow transitions, autosave, media upload, revisions and restore |
| `src/components/contact/contact-form.tsx` | public contact messages with field-error handling |
| `src/components/units/unit-registration-cta.tsx` | unit-scoped public pre-registration |

## Confirmed backend gaps and deliberate limits

- No optimistic-concurrency token, ETag, or dedicated autosave endpoint.
  Autosave is debounced and serialized through `PATCH /api/cms/content/{id}/`;
  the client ignores stale save responses and revisions coalesce within a short
  autosave window.
- No WordPress synchronization endpoint or fields.
- No SEO keyword/canonical/comment-status fields in the current content models.
- No parent-child academic ownership model or child/year-filtered academic API.
  Parent routes render only supported account-scoped data and do not fabricate
  grades, attendance, programmes, or children.
- No unified cross-domain review-queue endpoint; queues are derived from
  scoped CMS lists and statuses.
- There is no separate WordPress integration. PHP is not used.
