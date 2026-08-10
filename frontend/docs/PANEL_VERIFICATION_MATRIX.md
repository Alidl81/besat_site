# Panel route and workflow verification matrix

This matrix covers the three approved user-facing panel families only: Admin,
Content/Media Manager, and Parent. The browser calls shown below are made
through the Next BFF at `/api/backend/...`; the endpoint column names the
verified Django path behind that BFF.

`Code` means the route is wired to the named request and has the listed UI
states. `Mock E2E` means a repeatable Playwright scenario should exercise that
flow against the repository's mock transport; it is not a substitute for the
real-backend role/scope check. A row marked `CMS owner` is deliberately outside
the CMS-editor implementation owned by this workstream and must be completed
by that owner's E2E suite before release.

## Shared shell checks

| role | route | page purpose | endpoint | permission | scope | loading | empty | error | success | mobile | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|
| All authenticated roles | all approved panel routes | Session-aware shell, unit context, account and message access | `GET /api/dashboard/context/`, `GET /api/me/` | Active authenticated account; server remains authoritative | Context returns only accessible units | Context placeholder reserves space | Clear no-unit and no-academic-year messages | Context failure is announced in the mobile bar; route request errors offer retry | Unit switch rewrites `?unit=` without a full-page jump | 44px menu, sticky header, focus-trapped drawer, Escape, scroll lock and focus restore | `panel.spec.ts`: admin landing and drawer; run on mobile/tablet/laptop/desktop |
| General manager / unit manager | hidden Admin direct routes | Prevent a client-side fallback from displaying an unauthorized page | No mutation; target request is never used as an authorization bypass | Menu visibility is role-filtered; backend independently returns 403 | GM all units; UM own assigned unit | N/A | N/A | Explicit `role=alert` forbidden state | User chooses a visible route; no simulated success | Same state on compact shell | Add direct-URL role regression before release |
| Parent | panel context filters | Do not present a nonfunctional academic-year filter | `GET /api/dashboard/context/` | Parent only | Academic years are currently an empty verified context field | Context placeholder | “Year unavailable” copy | Context failure is announced | Child selection lives in the real children/programs routes, not a dead top-bar select | Compact explanatory state, no fake dropdown | Covered with parent workflow scenario |

## Admin panel

| role | route | page purpose | endpoint | permission | scope | loading | empty | error | success | mobile | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GM; UM | `/dashboard/admin` | Real management overview | `GET /api/dashboard/general-manager/` (GM) or `/api/dashboard/unit-manager/?unit_id=` (UM) | GM/UM; server denies other roles | GM all units; UM assigned unit | `PanelLoading` | Feed/unit-detail absence is explicit; no zeroed metric is invented | `PanelError` + retry | Response cards are rendered; unit titles without supplied per-unit metrics say so | Shared shell; cards collapse | `panel.spec.ts` admin landing; add scoped-UM request assertion |
| GM; UM | `/dashboard/admin/events` | List and create school/unit events | `GET/POST /api/cms/events/` | Event CMS permission | GM school or selected unit; UM own unit | `PanelLoading` | `PanelEmpty` | List/create error + retry/message | POST uses `event_start_at`, `event_end_at`, `scope`, and real `unit`; success follows server response then reload | Modal/form reflows; unit choices are real context values | Add GM create and UM own-unit/forbidden-unit scenarios |
| GM | `/dashboard/admin/reports` | View and download management report | `GET /api/cms/reports/overview/`; `GET /api/cms/reports/export/` | GM only | All active units | `PanelLoading` | Explicit no-report/no-unit states | `PanelError`; download failure alert | Actual response metrics/table and server download | Table scrolls horizontally inside its container | Add GM download and UM 403 scenarios |
| GM | `/dashboard/admin/settings` | Reserved management settings route | No verified writable management-settings API | GM route only | N/A | N/A | Honest unsupported state | N/A | No save control is shown | Responsive unsupported state | Verify route renders without a mutation request |
| GM | `/dashboard/admin/units` | CRUD educational units | `GET/POST/PATCH/DELETE /api/cms/units/` | GM writes; non-GM active-only visibility | GM all; non-GM server-scoped | CRUD spinner | “No unit” state | Server error is shown by CRUD manager | Modal closes only after API mutation resolves | Table has contained horizontal scroll | Add create/edit/delete with real IDs; assert UM cannot mutate global data |
| GM; UM | `/dashboard/admin/students` | List, edit, import, export students | `/api/cms/students/`, `summary/`, `bulk-import/`, `export/` | GM/UM only | GM all or selected unit; UM own unit | `PanelLoading` | `PanelEmpty` | `PanelError` and action errors | Read/mutation/import/export use response data | Filters/table remain usable at 320px | Add UM cross-unit denial and import/export check |
| GM; UM | `/dashboard/admin/staff` | CRUD staff | `GET/POST/PATCH/DELETE /api/cms/staff/` | Backend-defined GM/UM rule | Assigned-unit enforcement by server | CRUD spinner | “No staff” state | CRUD server error | Server-confirmed create/update/delete | Contained table/modal | Add role and unit-scope scenarios |
| GM; UM | `/dashboard/admin/content` | Unified content workspace | `/api/cms/content/` and workflow/revision/media endpoints | Scoped CMS role | GM global; UM own unit | CMS owner | CMS owner | CMS owner | CMS owner | Shell responsive; editor implementation excluded here | CMS owner suite required |
| GM; UM | `/dashboard/admin/gallery` | Manage gallery and select/upload media | `/api/cms/gallery/`; `/api/cms/media/` | GM/UM scoped CMS permissions | GM global; UM own unit | CRUD/media request states | No-gallery state | CRUD/media error states | API response controls gallery state | Contained table and picker dialog | Add upload/list/scope scenario |
| GM | `/dashboard/admin/pages` | Edit supported static pages | `/api/cms/static-pages/` | GM | School-wide | CRUD spinner | No-page state | CRUD error | Server-confirmed save | Dialog/form reflows | Add page PATCH + public read verification |
| GM; UM | `/dashboard/admin/registrations` | Review registration requests and actions | `/api/cms/registration-requests/`, `summary/`, `{id}/`, `{id}/{action}/` | GM/UM | GM all; UM own unit | `PanelLoading` | Explicit no-request state | List/detail/action errors and retry | Detail/action state is reloaded from API | Filter/table/detail stack on small widths | Add own-unit action and cross-unit 403 |
| GM | `/dashboard/admin/users` | Manage accounts and roles | `/api/cms/users/` | GM only | School-wide | CRUD spinner | No-user state | CRUD error | Server-confirmed mutation | Contained table/modal | Add GM CRUD and non-GM 403 |
| GM; UM | `/dashboard/admin/messages` | Internal inbox, compose, read, delete | `/api/cms/internal-messages/`, `recipients/`, `{id}/mark-read/` | Active authenticated account | Sender/recipient/allowed broadcast only | `PanelLoading` | No-message state | Retry/action errors | API-confirmed send/read/delete | Tabs/forms fit compact shell | Add recipient scope and message actions |
| GM; UM | `/dashboard/admin/profile` | Update own profile, avatar, password | `/api/me/profile/`, `avatar/`, `change-password/` | Own active account | Self only | Profile load state | Missing optional profile fields remain blank | Inline save/password result | Shows success only after endpoint response | Stacked forms and 44px controls | Add profile/password success/failure |

## Content/Media Manager panel

| role | route | page purpose | endpoint | permission | scope | loading | empty | error | success | mobile | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Unit media; permitted GM/UM | `/dashboard/content-manager` | Real media overview | `GET /api/dashboard/media/?unit_id=` | Media dashboard permission | Assigned unit | `PanelLoading` | No feed/storage state | `PanelError` + retry | Metrics/feed from response only | Shared shell/cards collapse | Add unit-media dashboard request assertion |
| Unit media | `/dashboard/content-manager/content` | Unified content workspace | `/api/cms/content/` + workflow/revisions/media | Scoped CMS access | Assigned unit | CMS owner | CMS owner | CMS owner | CMS owner | Shell responsive; editor excluded | CMS owner suite required |
| Unit media | `/dashboard/content-manager/news` | News-focused unified workspace | Same unified content endpoints, `kind=news` | Scoped CMS access | Assigned unit | CMS owner | CMS owner | CMS owner | CMS owner | Shell responsive; editor excluded | CMS owner suite required |
| Unit media | `/dashboard/content-manager/announcements` | Announcement-focused unified workspace | Same unified content endpoints, `kind=announcement` | Scoped CMS access | Assigned unit | CMS owner | CMS owner | CMS owner | CMS owner | Shell responsive; editor excluded | CMS owner suite required |
| Unit media | `/dashboard/content-manager/calendar` | List/create unit-scoped events | `GET/POST /api/cms/events/` | Event CMS permission | Own unit only | `PanelLoading` | `PanelEmpty` | Action error/retry | Uses real context-unit value and response reload | Modal/form reflow | Add create with own-unit assertion |
| Unit media | `/dashboard/content-manager/media` | Manage media-backed gallery items | `/api/cms/gallery/`; `/api/cms/media/` | Scoped CMS access | Assigned unit | CRUD/media request states | No-media state | CRUD/media error | API response controls state | Picker/table fit compact shell | Add scoped upload/list |
| Unit media | `/dashboard/content-manager/albums` | Gallery/album organization | `/api/cms/gallery/`; `/api/cms/media/` | Scoped CMS access | Assigned unit | CRUD/media request states | No-album state | CRUD/media error | API response controls state | Picker/table fit compact shell | Add scoped album mutation |
| Unit media | `/dashboard/content-manager/review` | Review-filtered unified workspace | `/api/cms/content/` and verified review transitions | Scoped CMS access | Assigned unit | CMS owner | CMS owner | CMS owner | CMS owner | Shell responsive; editor excluded | CMS owner suite required |
| Unit media | `/dashboard/content-manager/messages` | Internal messages | `/api/cms/internal-messages/` and recipient/action paths | Active authenticated account | Recipient/sender scope | `PanelLoading` | No-message state | Retry/action errors | API-confirmed send/read/delete | Compact tabs/forms | Add messaging workflow |
| Unit media | `/dashboard/content-manager/services` | Show active services for content role | `GET /api/cms/services/?audience=staff` | Active authenticated account | Backend service audience | `PanelLoading` | “No active service” state | `PanelError` + retry | Each displayed URL comes from response | Card grid collapses | Add service empty/populated scenario |
| Unit media | `/dashboard/content-manager/profile` | Update own account | `/api/me/profile/`, `avatar/`, `change-password/` | Own active account | Self only | Profile load state | Blank optional fields | Inline save/password result | Endpoint-confirmed result | Stacked forms | Add profile workflow |

## Parent panel

| role | route | page purpose | endpoint | permission | scope | loading | empty | error | success | mobile | E2E |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Parent | `/dashboard/parents` | Account-scoped parent overview | `GET /api/dashboard/parents/` | Parent only | Own account | `PanelLoading` | No schedule/feed state is explicit; no fabricated academic records | `PanelError` + retry | Server cards and only supplied data render | Shared shell/cards collapse | Add parent dashboard 200 and non-parent 403 |
| Parent | `/dashboard/parents/children` | Select a linked child and view detail | `GET /api/parents/children/`; `GET /api/parents/children/{id}/?academic_year=` | Parent only | Backend filters `student.parent=request.user` | List/detail loading | Clear “no child linked” state | List/detail retry | Selecting child writes `?child=` and fetches that child only; absent grades/attendance stay absent | Child cards/detail stack | Add own-child selection and foreign-child 404/403 check |
| Parent | `/dashboard/parents/programs` | Child-centred programme list | `GET /api/parents/children/`; `GET /api/parents/programs/?child=` | Parent only | Server derives programs from parent's child units | Child/program loading | Must select a child; then no-program state | Retry on child/program error | Native selection writes `?child=` before programme request | Select and cards stack | Add query assertion and own-family scope check |
| Parent | `/dashboard/parents/registration` | Track own submitted registrations | `GET /api/parents/registrations/` | Parent only | `submitted_by=request.user` | `PanelLoading` | No-active-registration state | `PanelError` + retry | Response progress/steps only; missing academic year is labeled absent | Cards stack | Add own-submission and same-phone foreign submission exclusion |
| Parent | `/dashboard/parents/services` | Show active family services | `GET /api/cms/services/?audience=parent` | Parent authenticated | Backend audience filter | `PanelLoading` | No-active-service state | `PanelError` + retry | Response URLs only | Card grid collapses | Add empty/populated scenario |
| Parent | `/dashboard/parents/messages` | Internal messages | `/api/cms/internal-messages/` and recipient/action paths | Parent authenticated | Sender/recipient scope | `PanelLoading` | No-message state | Retry/action errors | API-confirmed send/read/delete | Compact tabs/forms | Add sender/recipient isolation |
| Parent | `/dashboard/parents/profile` | Update own profile/contact details | `/api/me/profile/`, `avatar/`, `change-password/` | Own active account | Self only | Profile load state | Blank optional fields | Inline save/password result | Endpoint-confirmed result | Stacked forms | Add profile/password workflow |

## Explicit route boundaries

- `/dashboard/unit-manager/*` redirects to `/dashboard/admin/*`; it is not a
  fourth user-facing panel. Unit management is represented by the scoped
  `unit_manager` role in the Admin shell.
- `/dashboard/media/*` redirects to `/dashboard/content-manager/*`; it is not
  a separate panel family.
- The legacy Admin `departments` and `home-slider` pages return `notFound()`;
  `requests` and `media` redirect to their supported Admin routes. They must
  not be surfaced in panel navigation.
- The top-bar calendar and notification buttons were removed because there is
  no verified destination/action endpoint. The remaining message control is a
  real panel route.
- Academic years are not exposed by the current dashboard context. The UI
  keeps a clear unavailable state rather than offering an inert select. Child
  selection is real and is persisted in `?child=` for child-detail/program
  requests.

## Release completion rule

Mark a row complete only after the endpoint/status/role evidence and its
listed browser scenario have passed against the real backend. Mock E2E is a
fast regression check; it does not prove authorization or data scope on its
own.
