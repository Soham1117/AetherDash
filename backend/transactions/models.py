from django.db import models
from accounts.models import Account


from django.conf import settings


class Tag(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tags"
    )
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, default="#FFFFFF")

    class Meta:
        unique_together = ("user", "name")

    def __str__(self):
        return self.name


class CategorizationRule(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="categorization_rules",
    )
    category_ref = models.ForeignKey("categories.Category", on_delete=models.CASCADE)
    match_value = models.CharField(max_length=255)

    MATCH_TYPES = [
        ("contains", "Contains"),
        ("equals", "Equals"),
        ("starts_with", "Starts With"),
        ("regex", "Regex"),
    ]
    match_type = models.CharField(
        max_length=20, choices=MATCH_TYPES, default="contains"
    )

    def matches(self, text):
        if not text:
            return False
        if self.match_type == "contains":
            return self.match_value.lower() in text.lower()
        if self.match_type == "equals":
            return self.match_value.lower() == text.lower()
        if self.match_type == "starts_with":
            return text.lower().startswith(self.match_value.lower())
        if self.match_type == "regex":
            import re

            try:
                return bool(re.search(self.match_value, text, re.I))
            except re.error:
                return False
        return False

    def __str__(self):
        return f"Rule: '{self.match_value}' -> {self.category_ref.name}"


class Transaction(models.Model):
    id = models.AutoField(primary_key=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="transactions")
    account = models.ForeignKey(
        Account, on_delete=models.CASCADE, related_name="transactions"
    )
    # Plaid Data
    plaid_transaction_id = models.CharField(
        max_length=255, null=True, blank=True, unique=True, db_index=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    name = models.CharField(max_length=255, default="Transaction")  # Was description
    merchant_name = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateField(default="2024-01-01")
    category = models.CharField(max_length=100, blank=True, null=True)
    category_ref = models.ForeignKey(
        "categories.Category",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
    )
    payment_channel = models.CharField(max_length=50, blank=True, null=True)
    pending = models.BooleanField(default=False)

    # Transfer Intelligence
    is_transfer = models.BooleanField(default=False)
    transfer_match = models.OneToOneField(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="match_reverse",
    )

    # Internal
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-link category_ref if we have a category name but no ref
        if self.category and not self.category_ref:
            from categories.models import Category

            # Case-insensitive match on name
            cat = Category.objects.filter(name__iexact=self.category).first()
            if cat:
                self.category_ref = cat

        # Apply Categorization Rules if uncategorized
        if not self.category_ref and not self.category:
            try:
                # Ensure account is loaded/accessible
                if hasattr(self, "account") and self.account:
                    user = self.account.user
                    rules = CategorizationRule.objects.filter(user=user)
                    for rule in rules:
                        if rule.matches(self.name) or (
                            self.merchant_name and rule.matches(self.merchant_name)
                        ):
                            self.category_ref = rule.category_ref
                            self.category = rule.category_ref.name
                            break
            except Exception:
                # Ignore errors during auto-categorization (e.g. account not set yet)
                pass

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} (${self.amount})"


class TransactionLineItem(models.Model):
    transaction = models.ForeignKey(
        Transaction, on_delete=models.CASCADE, related_name="line_items"
    )
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True, null=True)
    category_ref = models.ForeignKey(
        "categories.Category",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transaction_line_items",
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} for {self.transaction.name}"


class RecurringTransaction(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurring_transactions",
    )
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    FREQUENCY_CHOICES = [
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
        ("yearly", "Yearly"),
    ]
    frequency = models.CharField(
        max_length=20, choices=FREQUENCY_CHOICES, default="monthly"
    )
    STATUS_CHOICES = [
        ("active", "Active"),
        ("overdue", "Overdue"),
        ("cancelled", "Cancelled"),
        ("discontinued", "Discontinued"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    next_due_date = models.DateField(null=True, blank=True)
    category_ref = models.ForeignKey(
        "categories.Category", on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)  # Kept for backward compatibility
    detected_by_system = models.BooleanField(default=False)
    merchant_name = models.CharField(max_length=255, null=True, blank=True)
    last_transaction_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.amount}/{self.frequency})"


class SavingsGoal(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="savings_goals"
    )
    name = models.CharField(max_length=255)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deadline = models.DateField(null=True, blank=True)
    icon = models.CharField(max_length=50, null=True, blank=True)  # emoji or icon name
    color = models.CharField(max_length=20, default="#10B981")  # green by default
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def progress_percentage(self):
        if self.target_amount <= 0:
            return 100
        return min(
            round((float(self.current_amount) / float(self.target_amount)) * 100, 1),
            100,
        )

    def __str__(self):
        return f"{self.name} (${self.current_amount}/${self.target_amount})"


class RecurringTransactionExclusion(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recurring_exclusions",
    )
    name_pattern = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Excluded: {self.name_pattern}"
