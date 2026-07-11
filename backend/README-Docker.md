# اجرای Docker بک‌اند بسات

این بسته فقط فایل‌های Docker بک‌اند را شامل می‌شود. فایل‌ها را در ریشه پروژه بک‌اند قرار دهید.

## اجرا

```bash
cp docker.env.example docker.env
# مقادیر change-me و دامنه‌ها را در docker.env تغییر دهید.
docker compose --env-file docker.env -f docker-compose.backend.yml config --quiet
docker compose --env-file docker.env -f docker-compose.backend.yml up --build -d
docker compose --env-file docker.env -f docker-compose.backend.yml ps
```

بررسی سلامت:

```bash
curl http://localhost:8000/api/health/
```

ساخت مدیر Django:

```bash
docker compose --env-file docker.env -f docker-compose.backend.yml exec backend python manage.py createsuperuser
```

مشاهده لاگ‌ها:

```bash
docker compose --env-file docker.env -f docker-compose.backend.yml logs -f backend
```

## نکات استقرار

- در production مقدار `SECURE_SSL_REDIRECT=True` و HSTS را فقط پس از قرارگرفتن reverse proxy و HTTPS فعال کنید.
- فایل‌های `media` باید توسط reverse proxy یا object storage سرو شوند؛ Django در حالت production آن‌ها را مستقیم سرو نمی‌کند.
- در اجرای چند replica، migration را فقط در یک job استقرار اجرا و برای replicaها `RUN_MIGRATIONS=0` تنظیم کنید.
- رمز PostgreSQL در compose ثابت نیست و باید در `docker.env` تعیین شود.
