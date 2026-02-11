from django.db import models
from django.contrib.auth.models import User

class PlaidConnection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="plaid_connections")
    access_token = models.CharField(max_length=255)
    item_id = models.CharField(max_length=255, unique=True)
    institution_id = models.CharField(max_length=100, null=True, blank=True)
    institution_name = models.CharField(max_length=255, null=True, blank=True)
    next_cursor = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"PlaidConnection({self.item_id}) - {self.institution_name or 'Unknown Bank'}"
