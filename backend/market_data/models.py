from django.db import models


class TrackedSymbol(models.Model):
    symbol = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=255, blank=True, default="")
    asset_type = models.CharField(max_length=64, blank=True, default="etf")
    provider = models.CharField(max_length=64, blank=True, default="yfinance")
    target_weight_percent = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True)
    active = models.BooleanField(default=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["symbol"]

    def __str__(self):
        return self.symbol


class MarketDailyBar(models.Model):
    symbol = models.CharField(max_length=20)
    date = models.DateField()
    provider = models.CharField(max_length=64, blank=True, default="yfinance")
    open = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    high = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    low = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    close = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    volume = models.BigIntegerField(null=True, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("symbol", "date", "provider")]
        ordering = ["symbol", "-date"]
        indexes = [
            models.Index(fields=["symbol", "-date"]),
            models.Index(fields=["provider", "symbol"]),
        ]

    def __str__(self):
        return f"{self.symbol} {self.date}"


class MarketMetricSnapshot(models.Model):
    symbol = models.CharField(max_length=20)
    as_of = models.DateField()
    provider = models.CharField(max_length=64, blank=True, default="yfinance")
    latest_close = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    return_1d_percent = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    return_5d_percent = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    return_1m_percent = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    volatility_20d_percent = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    moving_average_20d = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    moving_average_50d = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    rsi_14 = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("symbol", "as_of", "provider")]
        ordering = ["symbol", "-as_of"]
        indexes = [
            models.Index(fields=["symbol", "-as_of"]),
            models.Index(fields=["provider", "symbol"]),
        ]

    def __str__(self):
        return f"{self.symbol} metrics {self.as_of}"
