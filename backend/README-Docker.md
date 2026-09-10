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

- `docker-compose.backend.yml` مقدار `DJANGO_SETTINGS_MODULE=config.settings.production` را مستقیماً در تنظیمات سرویس `backend` ثابت کرده است (این مقدار همیشه بر مقدار مشابه در `docker.env` اولویت دارد)، بنابراین این استقرار همیشه از تنظیمات production و گاردِ fail-closate آن (`config/settings/_production_guard.py`) استفاده می‌کند. اگر `SECRET_KEY`، `DATABASE_URL`، `ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS`، یا سایر مقادیر لازم در `docker.env` به‌درستی تنظیم نشده باشند (یا مقدار placeholder مانند `change-me` باقی مانده باشد)، کانتینر `backend` بالا نمی‌آید و healthcheck آن fail می‌شود — این رفتار عمدی و صحیح است، نه یک باگ؛ آن را با تغییر `DJANGO_SETTINGS_MODULE` یا دور زدن گارد دور نزنید، بلکه مقادیر `docker.env` را کامل کنید.
- در production مقدار `SECURE_SSL_REDIRECT=True` و HSTS را فقط پس از قرارگرفتن reverse proxy و HTTPS فعال کنید.
- فایل‌های `media` باید توسط reverse proxy یا object storage سرو شوند؛ Django در حالت production آن‌ها را مستقیم سرو نمی‌کند.
- در اجرای چند replica، migration را فقط در یک job استقرار اجرا و برای replicaها `RUN_MIGRATIONS=0` تنظیم کنید.
- رمز PostgreSQL در compose ثابت نیست و باید در `docker.env` تعیین شود.
