import json
import os
import re
import threading
from datetime import datetime
from io import BytesIO
from typing import Dict, List, Optional, Tuple

import boto3
from django.conf import settings
from django.db import close_old_connections, transaction as db_transaction
from django.http import JsonResponse, HttpResponse
from django.utils import timezone
from pdf2image import convert_from_bytes
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import Receipt, ReceiptItem as ReceiptItemModel
from .serializers import ReceiptItemSerializer, ReceiptSerializer
from .utils import (
    ReceiptItem,
    CategorizedItem,
    ReceiptMetadata,
    categorize_receipt_items,
    extract_receipt_data_from_text,
)


def _parse_receipt_date(value: Optional[str]) -> Optional[datetime.date]:
    if not value:
        return None
    raw = value.strip()
    if "T" in raw:
        raw = raw.split("T")[0]
    formats = (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%m-%d-%Y",
        "%d/%m/%Y",
        "%d/%m/%y",
        "%d-%m-%Y",
        "%b %d, %Y",
        "%B %d, %Y",
        "%d %b %Y",
        "%d %B %Y",
    )
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _build_empty_response(merchant_name="Unknown", date=None) -> Dict:
    return {
        "error": "No items could be extracted from the receipt. Please ensure the receipt image is clear and readable.",
        "items": [],
        "taxes": [],
        "discounts": [],
        "totals": {
            "subTotal": 0.0,
            "taxes": 0.0,
            "serviceFee": 0.0,
            "total": 0.0,
        },
        "merchant": {
            "name": merchant_name,
            "address": None,
            "phone": None,
            "website": None,
        },
        "transaction": {
            "date": date,
            "time": None,
            "payment_method": None,
        },
        "receipt_type": "other",
    }


def _process_receipt_bytes(file_bytes: bytes, file_name: str) -> Dict:
    aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
    aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
    if not aws_access_key or not aws_secret_key:
        raise ValueError(
            "AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
        )

    textract = boto3.client(
        "textract",
        region_name="us-east-1",
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
    )

    file_name = file_name.lower()
    is_pdf = file_name.endswith(".pdf") or file_bytes[:4] == b"%PDF"

    # Use detect_document_text ONLY (Cost Optimization)
    extracted_text = ""
    if is_pdf:
        print("[Textract] PDF detected. Converting to images...")
        images = convert_from_bytes(file_bytes, dpi=250)
        print(f"[Textract] PDF converted: {len(images)} page(s)")
        if len(images) == 0:
            raise ValueError("PDF conversion returned no images")

        for i, image in enumerate(images):
            print(f"[Textract] Processing PDF page {i + 1}/{len(images)}...")
            img_buffer = BytesIO()
            image.save(img_buffer, format="PNG")
            img_bytes = img_buffer.getvalue()

            text_resp = textract.detect_document_text(Document={"Bytes": img_bytes})
            extracted_text += "\n".join(
                block.get("Text", "")
                for block in text_resp.get("Blocks", [])
                if block.get("BlockType") == "LINE"
            ) + "\n"
    else:
        print("[Textract] Image detected. Processing directly...")
        text_resp = textract.detect_document_text(Document={"Bytes": file_bytes})
        extracted_text = "\n".join(
            block.get("Text", "")
            for block in text_resp.get("Blocks", [])
            if block.get("BlockType") == "LINE"
        )

    # Use OpenAI to extract structure from raw text
    categorized_items, metadata, merchant_name, total_amount, receipt_date_raw = extract_receipt_data_from_text(extracted_text)

    parsed_date = _parse_receipt_date(receipt_date_raw)
    receipt_date_value = parsed_date.isoformat() if parsed_date else None

    # Construct result dict mimicking old structure
    result = {
        "merchant_name": merchant_name,
        "total_amount": int(total_amount * 100),
        "receipt_date": receipt_date_value,
        "confidence_score": 1.0, # Dummy
        "line_items": [], # Not used by view directly
        "subtotal": metadata.subtotal,
        "tax": metadata.tax,
        "discount": metadata.discount,
        "tip": metadata.tip,
        "fees": metadata.fees,
        "payment_method": metadata.card_used,
    }

    if not categorized_items:
        return {
            "response_data": _build_empty_response(merchant_name, receipt_date_value),
            "result": result,
            "categorized_items": [],
            "metadata": metadata,
            "extracted_text": extracted_text,
            "parsed_date": parsed_date,
            "is_empty": True,
        }

    response_data = {
        "items": [
            {
                "type": "discount"
                if item.is_discount
                else ("tax" if item.is_tax else ("fee" if item.is_fee else "item")),
                "name": item.clean_name or item.name,
                "quantity": item.quantity or 1,
                "unit": "each",
                "priceAfterDiscount": (item.price / 100.0) if item.price else 0.0,
            }
            for item in categorized_items
        ],
        "taxes": [
            {"type": "Tax", "amount": (metadata.tax / 100.0) if metadata.tax else 0.0}
        ]
        if metadata.tax
        else [],
        "discounts": [
            {
                "type": "Discount",
                "amount": (metadata.discount / 100.0) if metadata.discount else 0.0,
            }
        ]
        if metadata.discount
        else [],
        "totals": {
            "subTotal": (metadata.subtotal / 100.0) if metadata.subtotal else 0.0,
            "taxes": (metadata.tax / 100.0) if metadata.tax else 0.0,
            "serviceFee": (metadata.fees / 100.0) if metadata.fees else 0.0,
            "total": total_amount,
        },
        "merchant": {
            "name": merchant_name,
            "address": None,
            "phone": None,
            "website": None,
        },
        "transaction": {
            "date": receipt_date_value,
            "time": None,
            "payment_method": metadata.card_used,
        },
        "receipt_type": _infer_receipt_type(categorized_items)
        if categorized_items
        else "other",
    }

    return {
        "response_data": response_data,
        "result": result,
        "categorized_items": categorized_items,
        "metadata": metadata,
        "extracted_text": extracted_text,
        "parsed_date": parsed_date,
        "is_empty": False,
    }

def _update_receipt_from_processing(
    receipt: Receipt,
    result: Dict,
    categorized_items: List[CategorizedItem],
    metadata: ReceiptMetadata,
    extracted_text: str,
    parsed_date: Optional[datetime.date],
    response_data: Dict,
) -> None:
    ReceiptItemModel.objects.filter(receipt=receipt).delete()

    for item in categorized_items:
        ReceiptItemModel.objects.create(
            receipt=receipt,
            name=item.name,
            clean_name=item.clean_name,
            price=item.price,
            quantity=item.quantity or 1,
            unit_price=item.unit_price,
            category_suggestion=item.category,
        )

    receipt.ocr_text = extracted_text
    receipt.merchant_name = result.get("merchant_name")
    receipt.total_amount = result.get("total_amount")
    receipt.receipt_date = parsed_date
    receipt.confidence_score = result.get("confidence_score")
    receipt.payment_method = result.get("payment_method")
    receipt.parsed_data = response_data
    receipt.is_processed = True
    receipt.processing_status = Receipt.STATUS_COMPLETED
    receipt.save()


@api_view(["POST"])
def process_receipt(request):
    if "file" not in request.FILES:
        return JsonResponse({"error": "No file uploaded"}, status=400)

    uploaded_file = request.FILES["file"]

    try:
        payload = _process_receipt_bytes(uploaded_file.read(), uploaded_file.name)
        return JsonResponse(payload["response_data"], safe=False)
    except Exception as e:
        error_message = str(e)
        error_type = type(e).__name__
        print(f"Error processing receipt ({error_type}): {e}")

        if "UnrecognizedClientException" in error_message or "InvalidClientTokenId" in error_message:
            error_message = "AWS credentials are invalid or expired. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
        elif "AccessDeniedException" in error_message:
            error_message = "AWS credentials do not have permission to use Textract. Please ensure your AWS user has Textract permissions."
        elif "UnsupportedDocumentException" in error_message:
            error_message = "The document format is not supported by Textract. PDFs are now automatically converted to images. If this error persists, please try uploading a PNG or JPG image instead."
        elif "InvalidParameterException" in error_message:
            error_message = f"Invalid file format or parameter: {error_message}"
        elif "NoCredentialsError" in error_message or "Unable to locate credentials" in error_message:
            error_message = "AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."

        return JsonResponse(
            {
                "error": error_message,
                "error_type": error_type,
                "details": "Check backend console for full traceback.",
            },
            status=500,
        )


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def receipt_list_create(request):
    if request.method == "GET":
        receipts = Receipt.objects.filter(user=request.user).order_by("-created_at")
        serializer = ReceiptSerializer(receipts, many=True)
        return JsonResponse(serializer.data, safe=False)

    uploaded_file = request.FILES.get("receipt") or request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "No file uploaded"}, status=400)

    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
    }
    if uploaded_file.content_type not in allowed_types:
        return JsonResponse(
            {
                "error": "Invalid file type. Only JPEG, PNG images, and PDF files are allowed."
            },
            status=400,
        )

    receipts_dir = os.path.join(settings.BASE_DIR, "data", "receipts")
    os.makedirs(receipts_dir, exist_ok=True)

    ext = os.path.splitext(uploaded_file.name)[1].lower()
    filename = f"receipt_{{timezone.now().strftime('%Y%m%d%H%M%S%f')}}{ext}"
    filepath = os.path.join(receipts_dir, filename)
    with open(filepath, "wb") as handle:
        for chunk in uploaded_file.chunks():
            handle.write(chunk)

    receipt = Receipt.objects.create(
        user=request.user,
        image_path=f"data/receipts/{filename}",
        is_processed=False,
        processing_status=Receipt.STATUS_PENDING,
    )

    serializer = ReceiptSerializer(receipt)
    return JsonResponse(serializer.data, status=201)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_receipt(request):
    parsed = request.data
    if not isinstance(parsed, dict):
        return JsonResponse({"error": "Invalid payload"}, status=400)

    merchant_name = parsed.get("merchant", {}).get("name")
    receipt_date_raw = parsed.get("transaction", {}).get("date")
    receipt_date = _parse_receipt_date(receipt_date_raw)
    payment_method = parsed.get("transaction", {}).get("payment_method")

    totals = parsed.get("totals", {}) or {}
    total_amount = totals.get("total", 0) or 0
    subtotal = totals.get("subTotal", 0) or 0
    taxes = totals.get("taxes", 0) or 0
    service_fee = totals.get("serviceFee", 0) or 0

    receipt = Receipt.objects.create(
        user=request.user,
        image_path=None,
        merchant_name=merchant_name,
        total_amount=int(round(total_amount * 100)),
        receipt_date=receipt_date,
        payment_method=payment_method,
        parsed_data=parsed,
        is_processed=True,
        processing_status=Receipt.STATUS_COMPLETED,
    )

    items = parsed.get("items", []) or []
    for item in items:
        price = item.get("priceAfterDiscount", 0) or 0
        quantity = item.get("quantity", 1) or 1
        ReceiptItemModel.objects.create(
            receipt=receipt,
            name=item.get("name", "Item"),
            clean_name=item.get("name", "Item"),
            price=int(round(price * 100)),
            quantity=quantity,
            unit_price=None,
            category_suggestion=None,
        )

    receipt.parsed_data = {
        **parsed,
        "totals": {
            "subTotal": subtotal,
            "taxes": taxes,
            "serviceFee": service_fee,
            "total": total_amount,
        },
    }
    receipt.save(update_fields=["parsed_data"])

    serializer = ReceiptSerializer(receipt)
    return JsonResponse(serializer.data, status=201)


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def receipt_detail(request, receipt_id: int):
    receipt = Receipt.objects.filter(id=receipt_id, user=request.user).first()
    if not receipt:
        return JsonResponse({"error": "Receipt not found"}, status=404)

    if request.method == "GET":
        serializer = ReceiptSerializer(receipt)
        return JsonResponse(serializer.data, safe=False)

    if receipt.transaction_id:
        return JsonResponse(
            {"error": "Cannot delete receipt linked to a transaction."}, status=400
        )

    if receipt.image_path:
        filepath = os.path.join(settings.BASE_DIR, receipt.image_path)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

    receipt.delete()
    return JsonResponse({"success": True})

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def process_receipt_by_id(request, receipt_id: int):
    receipt = Receipt.objects.filter(id=receipt_id, user=request.user).first()
    if not receipt:
        return JsonResponse({"error": "Receipt not found"}, status=404)

    if receipt.is_processed or receipt.processing_status == Receipt.STATUS_COMPLETED:
        return JsonResponse({"error": "Receipt already processed"}, status=400)

    if not receipt.image_path:
        return JsonResponse({"error": "Receipt has no image to process"}, status=400)

    receipt.processing_status = Receipt.STATUS_PROCESSING
    receipt.save(update_fields=["processing_status", "updated_at"])

    def _run_background():
        close_old_connections()
        try:
            filepath = os.path.join(settings.BASE_DIR, receipt.image_path)
            with open(filepath, "rb") as handle:
                payload = _process_receipt_bytes(handle.read(), filepath)
            if payload["is_empty"]:
                receipt.processing_status = Receipt.STATUS_FAILED
                receipt.save(update_fields=["processing_status", "updated_at"])
                return

            with db_transaction.atomic():
                _update_receipt_from_processing(
                    receipt=Receipt.objects.select_for_update().get(id=receipt.id),
                    result=payload["result"],
                    categorized_items=payload["categorized_items"],
                    metadata=payload["metadata"],
                    extracted_text=payload["extracted_text"],
                    parsed_date=payload["parsed_date"],
                    response_data=payload["response_data"],
                )
        except Exception as exc:
            print(f"[Receipts] Background processing failed: {exc}")
            Receipt.objects.filter(id=receipt.id).update(
                processing_status=Receipt.STATUS_FAILED
            )

    threading.Thread(target=_run_background, daemon=True).start()

    return JsonResponse(
        {"id": receipt.id, "processing_status": "processing"}, status=202
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def receipt_status(request, receipt_id: int):
    receipt = Receipt.objects.filter(id=receipt_id, user=request.user).first()
    if not receipt:
        return JsonResponse({"error": "Receipt not found"}, status=404)

    status_map = {
        Receipt.STATUS_PENDING: "pending",
        Receipt.STATUS_PROCESSING: "processing",
        Receipt.STATUS_COMPLETED: "completed",
        Receipt.STATUS_FAILED: "failed",
    }

    payload = {
        "id": receipt.id,
        "status": status_map.get(receipt.processing_status, "unknown"),
        "is_processed": receipt.is_processed,
        "updated_at": receipt.updated_at,
    }

    if receipt.processing_status == Receipt.STATUS_COMPLETED:
        payload.update(
            {
                "ocr_text": receipt.ocr_text,
                "merchant_name": receipt.merchant_name,
                "total_amount": receipt.total_amount,
                "receipt_date": receipt.receipt_date.isoformat()
                if receipt.receipt_date
                else None,
                "confidence_score": receipt.confidence_score,
                "parsed_data": receipt.parsed_data,
            }
        )

    return JsonResponse(payload)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def receipt_items(request, receipt_id: int):
    receipt = Receipt.objects.filter(id=receipt_id, user=request.user).first()
    if not receipt:
        return JsonResponse({"error": "Receipt not found"}, status=404)

    items = ReceiptItemModel.objects.filter(receipt=receipt).order_by("id")
    serializer = ReceiptItemSerializer(items, many=True)
    return JsonResponse(serializer.data, safe=False)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def receipt_item_detail(request, receipt_id: int, item_id: int):
    receipt = Receipt.objects.filter(id=receipt_id, user=request.user).first()
    if not receipt:
        return JsonResponse({"error": "Receipt not found"}, status=404)

    item = ReceiptItemModel.objects.filter(receipt=receipt, id=item_id).first()
    if not item:
        return JsonResponse({"error": "Item not found"}, status=404)

    if request.method == "DELETE":
        item.delete()
        return JsonResponse({"success": True})

    data = request.data
    clean_name = data.get("clean_name")
    price = data.get("price")
    quantity = data.get("quantity")
    category_suggestion = data.get("category_suggestion")

    if clean_name is not None:
        item.clean_name = clean_name
    if price is not None:
        item.price = int(price)
    if quantity is not None:
        item.quantity = quantity
    if category_suggestion is not None:
        item.category_suggestion = category_suggestion

    item.save()
    return JsonResponse({"success": True})


@api_view(["GET"])
def receipt_image(request, filename: str):
    filepath = os.path.join(settings.BASE_DIR, "data", "receipts", filename)
    if not os.path.exists(filepath):
        return JsonResponse({"error": "Image not found"}, status=404)

    with open(filepath, "rb") as handle:
        file_bytes = handle.read()

    ext = os.path.splitext(filename)[1].lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".pdf": "application/pdf",
    }
    content_type = content_types.get(ext, "application/octet-stream")

    response = HttpResponse(file_bytes, content_type=content_type)
    if ext == ".pdf":
        response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


def _infer_receipt_type(items: List[CategorizedItem]) -> str:
    categories = [item.category for item in items]

    if any(cat in ["Groceries", "Dining"] for cat in categories):
        return "grocery" if "Groceries" in categories else "restaurant"
    if any(cat == "Transportation" for cat in categories):
        return "fuel"
    return "other"