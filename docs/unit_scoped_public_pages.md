# Unit Scoped Public Pages

هر واحد آموزشی باید بتواند محتوای اختصاصی خودش را داشته باشد.

## Frontend routes

```txt
/units/{slug}
/units/{slug}/news
/units/{slug}/announcements
/units/{slug}/gallery
Backend requirements

برای اتصال این صفحات به بک‌اند، این مسیرها لازم است:

GET /api/units/
GET /api/units/{slug}/
GET /api/content/?scope=unit&unit_id={unit_id}&type=news&status=published
GET /api/content/?scope=unit&unit_id={unit_id}&type=announcement&status=published
GET /api/content/?scope=unit&unit_id={unit_id}&type=gallery&status=published
Rules
هر خبر، اطلاعیه، گالری یا رویداد وابسته به واحد باید unit_id داشته باشد.
محتوای عمومی مجموعه نباید unit_id داشته باشد.
مدیر واحد فقط محتوای واحد خودش را مدیریت می‌کند.
همکار رسانه هر واحد فقط محتوای رسانه‌ای همان واحد را مدیریت می‌کند.
مدیر کل دسترسی کامل به همه واحدها دارد.

