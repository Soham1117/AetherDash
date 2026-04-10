from rest_framework import serializers
from .models import (
    Transaction,
    TransactionLineItem,
    TransactionEvidence,
    TransactionExtractedItem,
    Tag,
    CategorizationRule,
    RecurringTransaction,
    SavingsGoal,
)

class SavingsGoalSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = SavingsGoal
        fields = '__all__'
        read_only_fields = ['user', 'is_completed']
    
    def get_progress(self, obj):
        return obj.progress_percentage()

class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category_ref.name', read_only=True)
    class Meta:
        model = RecurringTransaction
        fields = '__all__'
        read_only_fields = ['user']

class CategorizationRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category_ref.name', read_only=True)
    class Meta:
        model = CategorizationRule
        fields = '__all__'
        read_only_fields = ['user']

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'

class TransactionLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionLineItem
        fields = "__all__"

class TransactionEvidenceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = TransactionEvidence
        fields = [
            "id",
            "transaction",
            "original_filename",
            "content_type",
            "evidence_type",
            "file_url",
            "status",
            "parser_used",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        try:
            return obj.file.url
        except Exception:
            return None


class TransactionExtractedItemSerializer(serializers.ModelSerializer):
    transaction_date = serializers.DateField(source="transaction.date", read_only=True)
    transaction_name = serializers.CharField(source="transaction.name", read_only=True)
    transaction_merchant = serializers.CharField(
        source="transaction.merchant_name", read_only=True
    )

    class Meta:
        model = TransactionExtractedItem
        fields = [
            "id",
            "transaction",
            "evidence",
            "name",
            "quantity",
            "unit_price",
            "line_total",
            "merchant_name",
            "item_date",
            "raw_line",
            "confidence",
            "transaction_date",
            "transaction_name",
            "transaction_merchant",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class TransactionSerializer(serializers.ModelSerializer):
    line_items = TransactionLineItemSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    evidence_files = TransactionEvidenceSerializer(many=True, read_only=True)
    extracted_items = TransactionExtractedItemSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), source='tags', write_only=True, required=False)
    transfer_override = serializers.BooleanField(required=False)

    class Meta:
        model = Transaction
        fields = "__all__"
