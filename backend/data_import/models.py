from django.db import models
from django.conf import settings
from transactions.models import Transaction

from accounts.models import Account

class BankStatement(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_REVIEW = 'review'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_REVIEW, 'Needs Review'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bank_statements')
    target_account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='statements', null=True, blank=True)
    file = models.FileField(upload_to='bank_statements/')
    original_filename = models.CharField(max_length=255)
    upload_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_message = models.TextField(blank=True, null=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    # Batch Processing Fields
    openai_batch_id = models.CharField(max_length=100, null=True, blank=True)
    extracted_text = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.original_filename} ({self.status})"

class ImportedTransaction(models.Model):
    statement = models.ForeignKey(BankStatement, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=500)
    
    # Matching confidence
    is_duplicate = models.BooleanField(default=False)
    duplicate_of = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='imported_matches')
    
    # Selection state for review
    selected_for_import = models.BooleanField(default=True)
    
    # Raw data for debugging
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"{self.date} - {self.amount} - {self.description}"
