from django.db import models


class SiteSettings(models.Model):
    school_name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, null=True)
    intro_text = models.TextField()
    hero_title = models.CharField(max_length=50)
    hero_subtitle = models.CharField(max_length=255, null=True)
    address = models.TextField()
    phone_primary = models.CharField(max_length=255, blank=True)
    phone_secondary = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField()
    
    