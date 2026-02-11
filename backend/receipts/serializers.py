from rest_framework import serializers
from .models import Receipt, ReceiptItem


class ReceiptItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceiptItem
        fields = [
            "id",
            "receipt",
            "name",
            "clean_name",
            "price",
            "quantity",
            "unit_price",
            "category_suggestion",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "receipt", "created_at", "updated_at"]


class ReceiptSerializer(serializers.ModelSerializer):
    transaction_id = serializers.IntegerField(
        source="transaction.id", read_only=True, allow_null=True
    )

    class Meta:
        model = Receipt
        fields = [
            "id",
            "user",
            "image_path",
            "ocr_text",
            "merchant_name",
            "total_amount",
            "receipt_date",
            "confidence_score",
            "payment_method",
            "parsed_data",
            "is_processed",
            "processing_status",
            "transaction_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "ocr_text",
            "merchant_name",
            "total_amount",
            "receipt_date",
            "confidence_score",
            "payment_method",
            "parsed_data",
            "is_processed",
            "processing_status",
            "transaction_id",
            "created_at",
            "updated_at",
        ]
