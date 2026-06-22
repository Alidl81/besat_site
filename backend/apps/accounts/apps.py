from django.apps import AppConfig


class AccountsConfig(AppConfig):
    defualt_auto_field = "django.db.models.BigAutoField"
    name = 'apps.accounts'
    verbose_name = "کاربران و نقش ها"


    def ready(self):
        import apps.accounts.signals # noqa: F401