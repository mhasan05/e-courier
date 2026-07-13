from django.db import models


class SiteSettings(models.Model):
    """Singleton holding site-wide branding + contact info the admin controls.

    Always stored at pk=1 (see load()/save()). Read publicly (branding shows on
    the login and landing pages); written by admins only.
    """

    company_name = models.CharField(max_length=120, default="Courier CMS")
    logo = models.ImageField(upload_to="branding/", null=True, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    contact_address = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def __str__(self):
        return self.company_name

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
