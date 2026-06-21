# Public News and Announcements

## Frontend routes

```txt
/news
/announcements
Backend routes needed
GET /api/news/?scope=school&status=published
GET /api/announcements/?scope=school&status=published
Rules
اخبار عمومی مدرسه scope=school دارد.
اطلاعیه‌های عمومی مدرسه scope=school دارد.
اخبار و اطلاعیه‌های هر واحد باید scope=unit و unit_id داشته باشد.

