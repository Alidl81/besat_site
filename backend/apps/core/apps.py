from django.apps import AppConfig


class CoreConfig(AppConfig):
    defualt_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
    verbose_name = "Core"
