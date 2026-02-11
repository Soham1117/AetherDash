from django.db import models
from accounts.models import Account


class Prediction(models.Model):
    PREDICTION_TYPES = [
        ("Balance", "Balance"),
        ("Transaction Count", "Transaction Count"),
    ]

    account = models.ForeignKey(
        Account, related_name="predictions", on_delete=models.CASCADE
    )
    prediction_date = models.DateField()
    predicted_balance = models.DecimalField(max_digits=10, decimal_places=2)
    prediction_type = models.CharField(choices=PREDICTION_TYPES, max_length=255)
    predicted_transaction_count = models.IntegerField()
    is_accurate = models.BooleanField(null=True, blank=True)

    def __str__(self):
        return f"Prediction for {self.account.account_name} on {self.prediction_date}"
