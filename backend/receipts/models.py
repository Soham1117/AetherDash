from django.db import models
from django.contrib.auth.models import User


class Receipt(models.Model):
    STATUS_PENDING = 0
    STATUS_PROCESSING = 1
    STATUS_COMPLETED = 2
    STATUS_FAILED = 3

    STATUS_CHOICES = [
        (STATUS_PENDING, "pending"),
        (STATUS_PROCESSING, "processing"),
        (STATUS_COMPLETED, "completed"),
        (STATUS_FAILED, "failed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="receipts")
    image_path = models.CharField(max_length=512, null=True, blank=True)
    ocr_text = models.TextField(null=True, blank=True)
    merchant_name = models.CharField(max_length=255, null=True, blank=True)
    total_amount = models.IntegerField(null=True, blank=True)  # cents
    receipt_date = models.DateField(null=True, blank=True)
    confidence_score = models.FloatField(null=True, blank=True)
    payment_method = models.CharField(max_length=255, null=True, blank=True)
    parsed_data = models.JSONField(null=True, blank=True)
    is_processed = models.BooleanField(default=False)
    processing_status = models.IntegerField(
        choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    transaction = models.OneToOneField(
        "transactions.Transaction",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receipt",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Receipt {self.id} ({self.user.username})"


class ReceiptItem(models.Model):
    receipt = models.ForeignKey(
        Receipt, on_delete=models.CASCADE, related_name="items"
    )
    name = models.CharField(max_length=255)
    clean_name = models.CharField(max_length=255, null=True, blank=True)
    price = models.IntegerField()  # cents
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price = models.IntegerField(null=True, blank=True)  # cents
    category_suggestion = models.CharField(max_length=100, null=True, blank=True)
    category_ref = models.ForeignKey(
        'categories.Category', on_delete=models.SET_NULL, null=True, blank=True, related_name="receipt_items"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.clean_name or self.name} ({self.receipt_id})"
