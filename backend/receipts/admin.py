from django.contrib import admin
from .models import Receipt, ReceiptItem


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "merchant_name", "total_amount", "processing_status", "created_at")
    list_filter = ("processing_status", "is_processed")
    search_fields = ("merchant_name", "image_path")


@admin.register(ReceiptItem)
class ReceiptItemAdmin(admin.ModelAdmin):
    list_display = ("id", "receipt", "clean_name", "price", "quantity", "category_suggestion")
    list_filter = ("category_suggestion",)

# Register your models here.
