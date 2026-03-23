from rest_framework import serializers
from .models import Account, CreditCardProfile


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            "id",
            "user",
            "account_name",
            "account_type",
            "subtype",
            "balance",
            "currency",
            "mask",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]


class CreditCardProfileSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.account_name", read_only=True)
    current_balance = serializers.DecimalField(source="account.balance", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = CreditCardProfile
        fields = [
            "id", "account", "account_name", "current_balance", "credit_limit",
            "target_statement_utilization_pct", "statement_day", "due_day", "notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "account_name", "current_balance"]
