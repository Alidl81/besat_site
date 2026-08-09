# Delivery Notes

## Source baseline

- Authoritative frontend archive: `frontend/frontend.zip`
- SHA-256: `48575CFA7526B4ECE221222812F714E6679E2D304262C1EAFCCC0B630266A104`
- Backend contract ref inspected: `origin/backend/mvp-bootstrap` at `ea5860fec717e0cc37d4fc1d16a4938adef1a917`

## Major delivery areas

- Cookie-based BFF authentication, refresh, logout, and permission-scoped panels.
- Public news, gallery, contact, unit pre-registration, About Us, and footer corrections backed by real contract fields.
- Separate news and achievements handling and native Tiptap JSON/HTML content support.
- Content workflow, revision history/restore, autosave coalescing, media upload, and raw editor rendering safeguards.
- Admin, Content Manager, and Parent panel navigation/route protection; no standalone user-facing unit-manager panel.
- RTL, accessibility, mobile drawer, desktop sidebar density, and reduced-motion coverage.
- Dependency remediation: `dompurify` and `nanoid` patch updates plus Next.js and `eslint-config-next` 16.2.9 to 16.3.0; the final production dependency audit reports zero vulnerabilities.

## Contract and environment references

The detailed frontend-to-backend route, payload, permission, and known-gap map is maintained in [FRONTEND_BACKEND_ENDPOINT_MAP.md](FRONTEND_BACKEND_ENDPOINT_MAP.md). Local runtime configuration is documented in [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md), and role scope is documented in [ROLE_PERMISSION_SCOPE_MATRIX.md](ROLE_PERMISSION_SCOPE_MATRIX.md).

## Backend schema additions

- `content.ContentRevision`
- `news.News.editor_json`
- `announcements.Announcement.editor_json`
- `registration.RegistrationRequest.submitted_by`

The corresponding migrations live under `backend/apps/content/migrations`, `backend/apps/news/migrations`, `backend/apps/announcements/migrations`, and `backend/apps/registration/migrations`.

## Repository handling

No user files were discarded and no history was rewritten. The completed work was organized into reviewed incremental commits and pushed normally to `origin/main` without a pull request or force-push. Test fixtures were isolated and the browser-run temporary database/state was cleaned up.
