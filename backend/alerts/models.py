from django.db import models
from django.conf import settings
from accounts.models import Account

class Alert(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alert_configs", null=True)
    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="alert_rules", null=True, blank=True
    )
    
    ALERT_TYPES = [
        ('low_balance', 'Low Balance'),
        ('unusual_spending', 'Unusual Spending'),
        ('budget_exceeded', 'Budget Exceeded'),
        ('bill_due', 'Bill Due'),
        ('large_transaction', 'Large Transaction'),
    ]
    alert_type = models.CharField(max_length=50, choices=ALERT_TYPES)
    threshold_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Custom message template (optional)
    alert_message = models.TextField(blank=True, help_text="Custom message template")
    
    is_active = models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_alert_type_display()} - {self.user}"

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    alert_rule = models.ForeignKey(Alert, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Optional: Link to related object (e.g., transaction ID)
    related_object_id = models.IntegerField(null=True, blank=True)
    related_object_type = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.user}"
