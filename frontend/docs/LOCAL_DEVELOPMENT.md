# Local Development And Test Data

## Frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Use `NEXT_PUBLIC_API_BASE_URL=/api/backend` and set the server-only
   `BESAT_BACKEND_API_URL` to the backend `/api` base URL. Do not put a bearer
   token, refresh token, or backend credential in `NEXT_PUBLIC_*`.
3. Run `npm run dev` from `frontend`.

For the contract-compatible persistent mock adapter, set
`BESAT_BACKEND_API_URL=mock://local`; the smoke and E2E commands create an
isolated operating-system temporary database and remove their synthetic record
afterwards. The production mock seed contains no falsely presented institutional
records.

## Backend

1. Copy `backend/.env.example` to `backend/.env` and provide a local-only
   `SECRET_KEY`.
2. Install `backend/requirements.txt` in a virtual environment.
3. Run `python manage.py migrate` using the selected Django settings module.
4. Run `python manage.py runserver` for a local API or use the supplied Docker
   configuration.

To create/update a local CMS administrator during container startup, set
`CMS_ADMIN_USERNAME`, `CMS_ADMIN_PASSWORD`, and optionally
`CMS_ADMIN_EMAIL`/`CMS_ADMIN_FULL_NAME` in the uncommitted backend `.env`.
Never commit a real password. No seed command creates real people, students, or
school data.

## LAN Development

`frontend/next.config.ts` explicitly allows the verified development origins
`192.168.10.65` and `192.168.10.71`, plus localhost. This setting is for Next
development HMR only; it does not loosen production CORS or backend
authorization. Add a LAN host to backend development `ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS`, and `CORS_ALLOWED_ORIGINS` only when that host is
actually used locally.

## Migrations In This Delivery

- `apps/news/migrations/0006_news_editor_json.py`
- `apps/announcements/migrations/0003_announcement_editor_json.py`
- `apps/content/migrations/0001_contentrevision.py`
- `apps/registration/migrations/0004_registrationrequest_submitted_by.py`

Apply these with the ordinary Django migration command. They are additive and
preserve existing news, announcement and registration records.
