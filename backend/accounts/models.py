from django.db import models
from django.contrib.auth.models import User


class Account(models.Model):
    ACCOUNT_TYPES = [
        ("bank", "Bank Account"),
        ("credit_card", "Credit Card"),
        ("cash", "Cash"),
        ("other", "Other"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accounts")
    account_name = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default="bank")
    subtype = models.CharField(max_length=50, null=True, blank=True)
    balance = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    plaid_account_id = models.CharField(max_length=100, null=True, blank=True, unique=True)
    mask = models.CharField(max_length=4, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.account_name} ({self.user.username})"


class CreditCardProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="credit_card_profiles")
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name="credit_profile")
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    target_statement_utilization_pct = models.DecimalField(max_digits=5, decimal_places=2, default=6.00)
    statement_day = models.PositiveSmallIntegerField(null=True, blank=True)
    due_day = models.PositiveSmallIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account"], name="unique_credit_profile_per_account"),
        ]

    def __str__(self):
        return f"{self.account.account_name} credit profile"
