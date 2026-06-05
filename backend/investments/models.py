from django.contrib.auth.models import User
from django.db import models


class SnapTradeConnection(models.Model):
    STATUS_PENDING = "pending"
    STATUS_ACTIVE = "active"
    STATUS_BROKEN = "broken"
    STATUS_DISCONNECTED = "disconnected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_ACTIVE, "Active"),
        (STATUS_BROKEN, "Broken"),
        (STATUS_DISCONNECTED, "Disconnected"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="snaptrade_connections")
    snaptrade_user_id = models.CharField(max_length=255, unique=True)
    user_secret = models.CharField(max_length=255)
    brokerage_authorization_id = models.CharField(max_length=255, null=True, blank=True)
    brokerage_name = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_holdings_sync_at = models.DateTimeField(null=True, blank=True)
    last_orders_sync_at = models.DateTimeField(null=True, blank=True)
    disabled_reason = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"SnapTradeConnection({self.user.username}, {self.brokerage_name or self.snaptrade_user_id})"


class InvestmentAccount(models.Model):
    connection = models.ForeignKey(SnapTradeConnection, on_delete=models.CASCADE, related_name="accounts")
    provider_account_id = models.CharField(max_length=255, unique=True)
    account_name = models.CharField(max_length=255)
    brokerage_name = models.CharField(max_length=255, blank=True, default="")
    account_type = models.CharField(max_length=100, blank=True, default="")
    account_number_mask = models.CharField(max_length=32, blank=True, default="")
    currency = models.CharField(max_length=8, default="USD")
    total_value = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    cash_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    buying_power = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["account_name"]

    def __str__(self):
        return f"{self.account_name} ({self.brokerage_name or 'Brokerage'})"


class Security(models.Model):
    symbol = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255, blank=True, default="")
    asset_type = models.CharField(max_length=100, blank=True, default="")
    currency = models.CharField(max_length=8, default="USD")
    exchange = models.CharField(max_length=100, blank=True, default="")
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["symbol"]

    def __str__(self):
        return self.symbol


class HoldingSnapshot(models.Model):
    account = models.ForeignKey(InvestmentAccount, on_delete=models.CASCADE, related_name="holdings")
    security = models.ForeignKey(Security, on_delete=models.CASCADE, related_name="holdings")
    quantity = models.DecimalField(max_digits=24, decimal_places=8, default=0)
    average_purchase_price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    current_price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    market_value = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    cost_basis = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    weight_percent = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    as_of = models.DateTimeField()
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("account", "security")]
        ordering = ["-market_value", "security__symbol"]


class OrderSnapshot(models.Model):
    account = models.ForeignKey(InvestmentAccount, on_delete=models.CASCADE, related_name="orders")
    provider_order_id = models.CharField(max_length=255, unique=True)
    symbol = models.CharField(max_length=50, blank=True, default="")
    side = models.CharField(max_length=32, blank=True, default="")
    status = models.CharField(max_length=64, blank=True, default="")
    order_type = models.CharField(max_length=64, blank=True, default="")
    quantity = models.DecimalField(max_digits=24, decimal_places=8, default=0)
    filled_quantity = models.DecimalField(max_digits=24, decimal_places=8, default=0)
    limit_price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    stop_price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    average_filled_price = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    placed_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-placed_at", "-updated_at"]
