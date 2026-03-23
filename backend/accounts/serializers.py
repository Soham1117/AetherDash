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

    def validate_account(self, value):
        if value.account_type != "credit_card":
            raise serializers.ValidationError("Profile can only be created for credit card accounts.")
        return value

    def validate_credit_limit(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Credit limit cannot be negative.")
        return value

    def validate_target_statement_utilization_pct(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Target utilization must be between 0 and 100.")
        return value

    def validate_statement_day(self, value):
        if value is not None and (value < 1 or value > 31):
            raise serializers.ValidationError("Statement day must be between 1 and 31.")
        return value

    def validate_due_day(self, value):
        if value is not None and (value < 1 or value > 31):
            raise serializers.ValidationError("Due day must be between 1 and 31.")
        return value
