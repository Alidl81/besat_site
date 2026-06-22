from django.apps import AppConfig


class NewsConfig(AppConfig):
    defualt_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.news'
    verbose_name = 'اخبار و اطلاعیه ها'
