from django.db import models
from django.contrib.auth.models import User

class Category(models.Model):
    name = models.CharField(max_length=100)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories", null=True, blank=True) # null for system categories
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='children')
    icon = models.CharField(max_length=50, null=True, blank=True) # Emoji or Lucide icon name
    color = models.CharField(max_length=20, null=True, blank=True) # Hex code
    is_system = models.BooleanField(default=False)
    
    class Meta:
        verbose_name_plural = "Categories"
        unique_together = ('name', 'parent', 'user')

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return self.name
