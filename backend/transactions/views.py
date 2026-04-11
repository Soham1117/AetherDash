from django.utils.timezone import now
from datetime import timedelta, date
from decimal import Decimal, InvalidOperation
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import (
    Transaction,
    Tag,
    CategorizationRule,
    RecurringTransaction,
    TransactionEvidence,
    TransactionExtractedItem,
)
from .serializers import (
    TransactionSerializer,
    TagSerializer,
    CategorizationRuleSerializer,
    RecurringTransactionSerializer,
    TransactionEvidenceSerializer,
    TransactionExtractedItemSerializer,
)
from .itemization_utils import extract_evidence_text, parse_itemized_text
from rest_framework import viewsets, status, filters
from datetime import datetime
from collections import defaultdict
from uuid import uuid4
from threading import Thread
from django.db import models, transaction as db_transaction
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
import os
import json
from calendar import monthrange
import openai
from dotenv import load_dotenv
from .services import TransferService, SubscriptionService
from .categorization_utils import (
    apply_transaction_category,
    get_allowed_category_map,
    normalize_to_allowed_category,
    remember_category,
    try_precategorize,
)

load_dotenv()

CATEGORIZATION_JOBS = {}

def canonical_merchant(name: str) -> str:
    raw = (name or "").strip()
    n = raw.lower()
    rules = [
        ("amazon", ["amazon", "amzn", "amz" ]),
        ("instacart", ["instacart"]),
        ("uber eats", ["uber eats", "uber*eats", "ubereats", "uber"]),
        ("walmart", ["walmart"]),
        ("zelle", ["zelle"]),
        ("great clips", ["great clips"]),
        ("trip.com", ["trip.com", "trip com"]),
    ]
    for canon, pats in rules:
        if any(p in n for p in pats):
            return canon.title()
    return raw[:80] or "Unknown"


class TransactionFilter(django_filters.FilterSet):
    """Custom filter for transactions with date range support"""
    date_after = django_filters.DateFilter(field_name='date', lookup_expr='gte')
    date_before = django_filters.DateFilter(field_name='date', lookup_expr='lte')
    amount_min = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    amount_max = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')
    
    class Meta:
        model = Transaction
        fields = ['account', 'category_ref', 'date', 'pending', 'is_transfer']


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = TransactionFilter
    search_fields = ['name', 'merchant_name', 'category']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date']  # Default ordering

    def _parse_date_value(self, value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            raw = value.strip()
            if "T" in raw:
                raw = raw.split("T")[0]
            for fmt in (
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
            ):
                try:
                    return datetime.strptime(raw, fmt).date()
                except ValueError:
                    continue
        return None

    def _parse_amount_value(self, value):
        if value is None:
            return None
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return None

    def _normalize_payload(self, data):
        payload = data.copy() if hasattr(data, "copy") else dict(data)

        if "description" in payload and not payload.get("name"):
            payload["name"] = payload.get("description")

        if "timestamp" in payload and not payload.get("date"):
            payload["date"] = payload.get("timestamp")

        if "date" in payload:
            parsed_date = self._parse_date_value(payload.get("date"))
            if parsed_date:
                payload["date"] = parsed_date.isoformat()

        transaction_type = payload.get("transaction_type")
        if transaction_type is not None and "amount" in payload:
            amount = self._parse_amount_value(payload.get("amount"))
            if amount is not None:
                type_value = str(transaction_type).lower()
                if type_value in {"debit", "expense"}:
                    payload["amount"] = str(-abs(amount))
                elif type_value in {"credit", "income"}:
                    payload["amount"] = str(abs(amount))

        return payload

    def get_queryset(self):
        user = self.request.user
        user_accounts = user.accounts.all()
        queryset = Transaction.objects.filter(account__in=user_accounts)
        print(
            f"[Transaction API] User: {user.username}, Accounts: {[a.id for a in user_accounts]}, Transaction count: {queryset.count()}"
        )
        return queryset

    def create(self, request, *args, **kwargs):
        payload = self._normalize_payload(request.data)
        serializer = self.get_serializer(data=payload)
        if not serializer.is_valid():
            print("[Transaction API] Create validation errors:", serializer.errors)
            print("[Transaction API] Create payload:", payload)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            transaction_obj = serializer.save()
            account = transaction_obj.account
            account.balance = (account.balance or Decimal("0")) + transaction_obj.amount
            account.save()

            # Handle line items if provided
            line_items_data = payload.get("line_items")
            if line_items_data and isinstance(line_items_data, list):
                from .models import TransactionLineItem

                for item_data in line_items_data:
                    # Clean the data to match model fields
                    TransactionLineItem.objects.create(
                        transaction=transaction_obj,
                        name=item_data.get("name", "Item"),
                        amount=Decimal(str(item_data.get("amount", 0))),
                        category=item_data.get("category"),
                        quantity=Decimal(str(item_data.get("quantity", 1))),
                    )

            receipt_id = payload.get("receipt_id")
            if receipt_id:
                from receipts.models import Receipt

                Receipt.objects.filter(id=receipt_id, user=request.user).update(
                    transaction=transaction_obj, is_processed=True
                )

            # Check alerts
            try:
                from alerts.services import AlertService

                AlertService().check_all_conditions(request.user)
            except Exception as e:
                print(f"Alert check failed: {e}")

        return Response(serializer.data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        payload = self._normalize_payload(request.data)
        serializer = self.get_serializer(instance, data=payload, partial=partial)
        if not serializer.is_valid():
            print("[Transaction API] Update validation errors:", serializer.errors)
            print("[Transaction API] Update payload:", payload)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        with db_transaction.atomic():
            old_account = instance.account
            old_amount = instance.amount
            updated = serializer.save()
            new_account = updated.account
            new_amount = updated.amount

            if old_account.id != new_account.id:
                old_account.balance = (old_account.balance or Decimal("0")) - old_amount
                old_account.save()
                new_account.balance = (new_account.balance or Decimal("0")) + new_amount
                new_account.save()
            else:
                delta = new_amount - old_amount
                if delta != 0:
                    old_account.balance = (old_account.balance or Decimal("0")) + delta
                    old_account.save()

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        with db_transaction.atomic():
            account = instance.account
            amount = instance.amount
            instance.delete()
            account.balance = (account.balance or Decimal("0")) - amount
            account.save()
        return Response(status=204)

    @action(detail=False, methods=["post"])
    def bulk_delete(self, request):
        """
        Delete multiple transactions at once.
        Expects: { "transaction_ids": [1, 2, 3] }
        """
        transaction_ids = request.data.get("transaction_ids", [])
        if not transaction_ids or not isinstance(transaction_ids, list):
            return Response({"error": "Invalid transaction_ids provided"}, status=400)

        user = request.user
        user_accounts = user.accounts.all()

        # Filter to ensure user owns these transactions
        queryset = Transaction.objects.filter(
            id__in=transaction_ids, account__in=user_accounts
        )

        count = 0
        with db_transaction.atomic():
            for txn in queryset:
                account = txn.account
                amount = txn.amount
                txn.delete()
                # Revert balance
                account.balance = (account.balance or Decimal("0")) - amount
                account.save()
                count += 1

        return Response({"deleted": count})

    @action(detail=False, methods=["get"])
    def filter_by_time_period(self, request):
        start = request.query_params.get("start")
        end = request.query_params.get("end")
        type = request.query_params.get("type")

        if type == "custom" and start and end:
            try:
                start = datetime.strptime(start, "%Y-%m-%d").date()
                end = datetime.strptime(end, "%Y-%m-%d").date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD."}, status=400
                )

            user = request.user
            user_accounts = user.accounts.all()
            queryset = Transaction.objects.filter(
                account__in=user_accounts,
                date__gte=start,
                date__lte=end,
            )

        else:
            today = now().date()
            user = request.user
            user_accounts = user.accounts.all()
            queryset = Transaction.objects.filter(account__in=user_accounts)

            if type == "today":
                queryset = queryset.filter(date=today)
            elif type == "week":
                start_date = today - timedelta(days=today.weekday())
                queryset = queryset.filter(date__gte=start_date)
            elif type == "month":
                start_date = today.replace(day=1)
                queryset = queryset.filter(date__gte=start_date)
            else:
                return Response({"error": "Invalid type value."}, status=400)

        serializer = self.get_serializer(queryset, many=True)

        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def trends(self, request):
        """
        Get spending trends over time, grouped by month and category.
        Query params: months (default 6)
        """
        from django.db.models import Sum
        from django.db.models.functions import TruncMonth
        from collections import defaultdict

        months = int(request.query_params.get("months", 6))
        user = request.user
        user_accounts = user.accounts.all()

        start_date = datetime.now().date().replace(day=1) - timedelta(days=30 * months)

        transactions = (
            Transaction.objects.filter(
                account__in=user_accounts,
                date__gte=start_date,
                amount__lt=0,  # Only expenses
                is_transfer=False,  # Exclude transfers
            )
            .annotate(month=TruncMonth("date"))
            .values("month", "category")
            .annotate(total=Sum("amount"))
            .order_by("month")
        )

        # Format into structured response
        result = defaultdict(lambda: defaultdict(float))
        categories_set = set()

        for item in transactions:
            month_str = item["month"].strftime("%Y-%m") if item["month"] else "Unknown"
            category = item["category"] or "Uncategorized"
            result[month_str][category] = abs(float(item["total"]))
            categories_set.add(category)

        # Convert to list format for frontend charts
        formatted = []
        for month, cats in sorted(result.items()):
            entry = {"month": month}
            entry.update(cats)
            formatted.append(entry)

        return Response({"trends": formatted, "categories": list(categories_set)})

    @action(detail=False, methods=["get"])
    def payee_suggestions(self, request):
        """
        Get unique payee/merchant suggestions based on query.
        Query params: q (search query)
        """
        query = request.query_params.get("q", "")
        user = request.user
        user_accounts = user.accounts.all()

        if len(query) < 2:
            return Response([])

        # Get distinct names/merchants matching query
        names = (
            Transaction.objects.filter(account__in=user_accounts, name__icontains=query)
            .values_list("name", flat=True)
            .distinct()[:10]
        )

        merchants = (
            Transaction.objects.filter(
                account__in=user_accounts, merchant_name__icontains=query
            )
            .values_list("merchant_name", flat=True)
            .distinct()[:10]
        )

        # Combine and dedupe
        suggestions = list(set(list(names) + [m for m in merchants if m]))[:15]

        return Response(suggestions)

    @action(detail=False, methods=["post"])
    def import_statement(self, request):
        """
        Import transactions from a bank statement file (CSV or OFX/QFX).
        Accepts multipart form data with 'file' and optional 'account_id'.
        For CSV: expects columns like date, description, amount (auto-detects common formats).
        For OFX/QFX: parses using ofxparse library.
        """
        import csv
        import io
        from accounts.models import Account

        file = request.FILES.get("file")
        account_id = request.data.get("account_id")
        preview_only = request.data.get("preview", "false").lower() == "true"

        if not file:
            return Response({"error": "No file provided"}, status=400)

        # Get account
        user = request.user
        if account_id:
            account = Account.objects.filter(id=account_id, user=user).first()
        else:
            account = Account.objects.filter(user=user).first()

        if not account:
            return Response({"error": "No account found"}, status=400)

        filename = file.name.lower()
        transactions_data = []

        try:
            content = file.read()

            if filename.endswith(".ofx") or filename.endswith(".qfx"):
                # Parse OFX/QFX
                from ofxparse import OfxParser

                ofx = OfxParser.parse(io.BytesIO(content))

                for acc in ofx.accounts:
                    for txn in acc.statement.transactions:
                        transactions_data.append(
                            {
                                "date": str(txn.date.date()) if txn.date else None,
                                "name": txn.memo or txn.payee or "Transaction",
                                "amount": float(txn.amount),
                                "type": "credit" if txn.amount > 0 else "debit",
                                "reference": txn.id,
                            }
                        )

            elif filename.endswith(".csv"):
                # Parse CSV - try to auto-detect format
                text = content.decode("utf-8-sig")  # Handle BOM
                reader = csv.DictReader(io.StringIO(text))

                # Try to find common column names
                fieldnames = [f.lower().strip() for f in (reader.fieldnames or [])]

                # Map common variations
                date_cols = [
                    "date",
                    "trans date",
                    "transaction date",
                    "posting date",
                    "posted date",
                ]
                desc_cols = [
                    "description",
                    "memo",
                    "narrative",
                    "details",
                    "payee",
                    "name",
                ]
                amount_cols = [
                    "amount",
                    "transaction amount",
                    "debit",
                    "credit",
                    "value",
                ]

                def find_col(options, fields):
                    for opt in options:
                        if opt in fields:
                            return list(reader.fieldnames)[fields.index(opt)]
                    return None

                date_col = find_col(date_cols, fieldnames)
                desc_col = find_col(desc_cols, fieldnames)
                amount_col = find_col(amount_cols, fieldnames)

                if not all([date_col, amount_col]):
                    return Response(
                        {
                            "error": "Could not detect CSV format",
                            "detected_columns": list(reader.fieldnames or []),
                            "hint": "CSV should have columns like: date, description, amount",
                        },
                        status=400,
                    )

                # Re-read with detected columns
                reader = csv.DictReader(io.StringIO(text))
                for row in reader:
                    try:
                        raw_amount = (
                            row.get(amount_col, "0")
                            .replace("$", "")
                            .replace(",", "")
                            .strip()
                        )
                        if raw_amount.startswith("(") and raw_amount.endswith(")"):
                            raw_amount = "-" + raw_amount[1:-1]
                        amount = float(raw_amount) if raw_amount else 0

                        transactions_data.append(
                            {
                                "date": row.get(date_col, ""),
                                "name": row.get(desc_col, "Transaction")
                                if desc_col
                                else "Transaction",
                                "amount": amount,
                                "type": "credit" if amount > 0 else "debit",
                            }
                        )
                    except (ValueError, KeyError) as e:
                        continue  # Skip malformed rows
            else:
                return Response(
                    {"error": "Unsupported file format. Use CSV or OFX/QFX."},
                    status=400,
                )

            if preview_only:
                return Response(
                    {
                        "preview": transactions_data[:50],
                        "total_count": len(transactions_data),
                        "account": account.account_name,
                    }
                )

            # Actually create transactions
            created = []
            for txn_data in transactions_data:
                try:
                    parsed_date = self._parse_date_value(txn_data.get("date"))
                    if not parsed_date:
                        continue

                    txn = Transaction.objects.create(
                        account=account,
                        name=txn_data.get("name", "Imported Transaction"),
                        amount=Decimal(str(txn_data.get("amount", 0))),
                        date=parsed_date,
                    )
                    created.append(txn.id)
                except Exception as e:
                    continue

            return Response(
                {
                    "imported": len(created),
                    "total_in_file": len(transactions_data),
                    "account": account.account_name,
                }
            )

        except Exception as e:
            return Response({"error": f"Failed to parse file: {str(e)}"}, status=400)


    def perform_update(self, serializer):
        instance = serializer.save()
        if not (instance.category or instance.category_ref):
            return
        remember_category(
            self.request.user,
            instance,
            instance.category_ref if instance.category_ref_id else instance.category,
        )

    @action(detail=False, methods=["post"])
    def categorize_with_ai(self, request):
        """
        Use AI to categorize transactions based on their descriptions.
        Accepts a list of transaction descriptions and returns suggested categories.
        If transaction_ids are provided, will also update the transactions in the database.
        Uses transfer/rule/merchant-memory shortcuts before calling the LLM; persists via
        apply_transaction_category so merchant memory is reinforced consistently.
        """
        try:
            descriptions = request.data.get("descriptions", [])
            transaction_ids = request.data.get("transaction_ids", [])
            auto_update = request.data.get("auto_update", False)

            if not descriptions or not isinstance(descriptions, list):
                return Response(
                    {"error": "descriptions must be a non-empty list"}, status=400
                )

            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                return Response({"error": "OpenAI API key not configured"}, status=500)

            client = openai.OpenAI(api_key=openai_api_key)
            user = request.user
            user_accounts = user.accounts.all()
            allowed_categories, categories_list_str = get_allowed_category_map(user)
            unc = allowed_categories.get("uncategorized", "Uncategorized")

            def iter_batches(items, size):
                for idx in range(0, len(items), size):
                    yield idx, items[idx : idx + size]

            all_category_results = []
            all_debug = []
            updated_count = 0

            print(f"[AI Categorization DEBUG] Input count: {len(descriptions)}")
            print(f"[AI Categorization DEBUG] Raw descriptions: {descriptions}")

            batch_size = 25
            for offset, batch in iter_batches(descriptions, batch_size):
                batch_ids = (
                    transaction_ids[offset : offset + len(batch)]
                    if transaction_ids
                    else []
                )
                txn_by_index = {}
                if batch_ids:
                    for bi, tid in enumerate(batch_ids):
                        if tid is None:
                            continue
                        t = Transaction.objects.filter(
                            id=tid, account__in=user_accounts
                        ).first()
                        if t:
                            txn_by_index[bi] = t

                resolved = [None] * len(batch)
                sources = ["none"] * len(batch)
                confidences: list = [None] * len(batch)

                for i, desc in enumerate(batch):
                    txn = txn_by_index.get(i)
                    cat, src, conf = try_precategorize(
                        user, desc or "", txn, allowed_categories
                    )
                    if cat is not None:
                        resolved[i] = cat
                        sources[i] = src
                        confidences[i] = conf

                llm_indices = [i for i, c in enumerate(resolved) if c is None]
                if llm_indices:
                    llm_descriptions = [batch[i] for i in llm_indices]
                    descriptions_text = "\n".join(
                        [f"{j + 1}. {d}" for j, d in enumerate(llm_descriptions)]
                    )
                    n_llm = len(llm_descriptions)
                    prompt = f"""You are a financial transaction categorizer. Categorize each transaction into one category from the list.

Available Categories: {categories_list_str}

Transactions (in order):
{descriptions_text}

Respond with a JSON object only, no markdown, in this exact shape:
{{"results": ["CategoryName1", "CategoryName2", ...]}}

The "results" array must have exactly {n_llm} strings, same order as the transactions above. Use 'Uncategorized' if unsure."""

                    max_tokens = min(1200, 60 * n_llm + 200)
                    response = client.chat.completions.create(
                        model="gpt-4o-mini",
                        response_format={"type": "json_object"},
                        messages=[
                            {
                                "role": "system",
                                "content": "You are a financial transaction categorizer. Reply with a single JSON object only.",
                            },
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.3,
                        max_tokens=max_tokens,
                    )

                    raw = response.choices[0].message.content.strip()
                    print("\n" + "=" * 60)
                    print(
                        f"[AI Categorization DEBUG] RAW PROMPT (batch {offset // batch_size + 1}):"
                    )
                    print("-" * 60)
                    print(prompt)
                    print("-" * 60)
                    print("[AI Categorization DEBUG] RAW AI OUTPUT:")
                    print("-" * 60)
                    print(raw)
                    print("=" * 60 + "\n")

                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError as e:
                        return Response(
                            {
                                "error": f"Failed to parse AI response: {str(e)}",
                                "batch_offset": offset,
                            },
                            status=500,
                        )

                    llm_cats = payload.get("results") or payload.get("categories")
                    if not isinstance(llm_cats, list):
                        return Response(
                            {
                                "error": "Invalid response format from AI (expected results array)",
                                "batch_offset": offset,
                            },
                            status=500,
                        )

                    if len(llm_cats) > n_llm:
                        llm_cats = llm_cats[:n_llm]
                    elif len(llm_cats) < n_llm:
                        llm_cats = llm_cats + [unc] * (n_llm - len(llm_cats))

                    for j, batch_i in enumerate(llm_indices):
                        raw_label = llm_cats[j]
                        if not isinstance(raw_label, str):
                            raw_label = unc
                        canonical = normalize_to_allowed_category(
                            raw_label.strip(), allowed_categories
                        )
                        resolved[batch_i] = canonical
                        sources[batch_i] = "llm"
                        confidences[batch_i] = 0.72

                batch_debug = []
                for i, desc in enumerate(batch):
                    category = resolved[i]
                    src = sources[i]
                    conf = confidences[i]
                    if conf is None:
                        conf = 0.65
                    reason = {
                        "transfer": "marked as internal transfer",
                        "rule": "keyword rule",
                        "memory": "merchant memory",
                        "llm": "openai",
                        "none": "unknown",
                    }.get(src, src)
                    batch_debug.append(
                        {
                            "description": desc,
                            "category": category,
                            "source": src,
                            "reason": reason,
                            "confidence": conf,
                        }
                    )

                print(
                    f"[AI Categorization DEBUG] Parsed categories (batch {offset // batch_size + 1}): {resolved}"
                )
                all_category_results.extend(resolved)
                all_debug.extend(batch_debug)

                if auto_update and batch_ids and len(batch_ids) == len(batch):
                    for txn_id, category in zip(batch_ids, resolved):
                        if category is None:
                            continue
                        try:
                            transaction = Transaction.objects.filter(
                                id=txn_id, account__in=user_accounts
                            ).first()
                            if transaction:
                                apply_transaction_category(
                                    user,
                                    transaction,
                                    category,
                                    remember=True,
                                    allowed_map=allowed_categories,
                                )
                                updated_count += 1
                        except Exception as e:
                            print(
                                f"[AI Categorization] Error updating transaction {txn_id}: {str(e)}"
                            )

            print(f"[AI Categorization DEBUG] Raw categories output: {all_category_results}")

            return Response(
                {
                    "categories": all_category_results,
                    "updated_count": updated_count if auto_update else 0,
                    "debug": all_debug,
                    "descriptions": descriptions,
                    "transaction_ids": transaction_ids,
                }
            )

        except json.JSONDecodeError as e:
            return Response(
                {"error": f"Failed to parse AI response: {str(e)}"}, status=500
            )
        except Exception as e:
            print(f"[AI Categorization Error] {str(e)}")
            import traceback

            traceback.print_exc()
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=["get"])
    def uncategorized(self, request):
        """
        Get all uncategorized transactions for the current user.
        """
        user = request.user
        user_accounts = user.accounts.all()
        queryset = Transaction.objects.filter(account__in=user_accounts).filter(
            models.Q(category__isnull=True)
            | models.Q(category="")
            | models.Q(category="Uncategorized")
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def detect_duplicates(self, request):
        """
        Detect potential duplicate transactions based on date, amount, and description.
        """
        from django.db.models import Count

        user = request.user
        user_accounts = user.accounts.all()

        # Look for transactions with same amount and date (within a 1-day window)
        duplicates = []
        transactions = list(
            Transaction.objects.filter(account__in=user_accounts).order_by("-date")
        )

        processed_ids = set()

        for i in range(len(transactions)):
            if transactions[i].id in processed_ids:
                continue

            match_group = [transactions[i]]
            for j in range(i + 1, len(transactions)):
                if transactions[j].id in processed_ids:
                    continue

                # Check if amount is identical and date is within 1 day
                date_diff = abs((transactions[i].date - transactions[j].date).days)
                if transactions[i].amount == transactions[j].amount and date_diff <= 1:
                    match_group.append(transactions[j])

            if len(match_group) > 1:
                duplicates.append(self.get_serializer(match_group, many=True).data)
                for txn in match_group:
                    processed_ids.add(txn.id)

        return Response(duplicates)

    @action(detail=False, methods=["post"])
    def categorize_with_ai_async(self, request):
        descriptions = request.data.get("descriptions", [])
        transaction_ids = request.data.get("transaction_ids", [])
        if not descriptions:
            return Response({"error": "descriptions must be provided"}, status=400)

        job_id = str(uuid4())
        CATEGORIZATION_JOBS[job_id] = {"status": "queued", "updated": str(now())}

        def _run():
            try:
                CATEGORIZATION_JOBS[job_id] = {"status": "running", "updated": str(now())}
                class _Req:
                    pass
                req = _Req()
                req.user = request.user
                req.data = {
                    'descriptions': descriptions,
                    'transaction_ids': transaction_ids,
                    'auto_update': True,
                }
                resp = self.categorize_with_ai(req)
                result = getattr(resp, 'data', None)
                if result is None:
                    result = {'status_code': getattr(resp, 'status_code', None)}
                CATEGORIZATION_JOBS[job_id] = {"status": "done", "result": result, "updated": str(now())}
            except Exception as e:
                CATEGORIZATION_JOBS[job_id] = {"status": "failed", "error": str(e), "updated": str(now())}

        Thread(target=_run, daemon=True).start()
        return Response({"job_id": job_id, "status": "queued"}, status=202)

    @action(detail=False, methods=["get"])
    def categorize_jobs(self, request):
        job_id = request.query_params.get('job_id')
        if job_id:
            return Response(CATEGORIZATION_JOBS.get(job_id, {"status": "not_found"}))
        return Response({"jobs": CATEGORIZATION_JOBS})


    @action(detail=False, methods=["post"])
    def detect_transfers(self, request):
        """
        Manually trigger transfer detection for the current user.
        """
        service = TransferService()
        matches_found, matches_details = service.detect_transfers(request.user)
        return Response(
            {
                "matches_found": matches_found,
                "matches": matches_details,
                "status": "Detection complete",
            }
        )


    @action(detail=False, methods=["get"])
    def payment_optimizer(self, request):
        from accounts.models import Account, CreditCardProfile

        cards = Account.objects.filter(user=request.user, account_type="credit_card", is_active=True)
        profiles = {
            p.account_id: p
            for p in CreditCardProfile.objects.filter(user=request.user, account__in=cards).select_related("account")
        }

        today = now().date()

        def _days_until(day):
            if not day:
                return None
            day = int(day)
            if day < 1 or day > 31:
                return None
            year, month = today.year, today.month
            while True:
                last_day = monthrange(year, month)[1]
                candidate = date(year, month, min(day, last_day))
                if candidate >= today:
                    return (candidate - today).days
                if month == 12:
                    month = 1
                    year += 1
                else:
                    month += 1

        recommendations = []
        total_due = Decimal("0")
        warnings = []

        for c in cards:
            bal = Decimal(str(c.balance or 0))
            due = bal if bal > 0 else Decimal("0")
            total_due += due

            profile = profiles.get(c.id)
            limit_val = Decimal(str(profile.credit_limit)) if profile and profile.credit_limit else Decimal("0")
            target_pct = Decimal(str(profile.target_statement_utilization_pct)) if profile and profile.target_statement_utilization_pct is not None else Decimal("6.0")
            util = (due / limit_val * 100) if limit_val > 0 else Decimal("0")
            target_balance = (limit_val * target_pct / Decimal("100")) if limit_val > 0 else Decimal("0")
            pay_before_statement = (due - target_balance) if due > target_balance else Decimal("0")
            statement_day = profile.statement_day if profile else None
            due_day = profile.due_day if profile else None
            days_until_statement = _days_until(statement_day)
            days_until_due = _days_until(due_day)

            priority = "low"
            recommended_action = "keep utilization healthy"
            alert_level = "ok"
            alert_text = ""

            if limit_val <= 0:
                priority = "medium"
                alert_level = "needs_setup"
                alert_text = "Set a credit limit to unlock accurate recommendations."
                recommended_action = "add card settings in Accounts"
            elif util >= 80:
                priority = "high"
                alert_level = "critical"
                alert_text = "Utilization is very high; pay down immediately."
                recommended_action = "pay immediately to reduce utilization"
            elif days_until_statement is not None and days_until_statement <= 3 and pay_before_statement > 0:
                priority = "high"
                alert_level = "warning"
                alert_text = f"Statement closes in {days_until_statement} day(s)."
                recommended_action = f"pay {pay_before_statement:.2f} before statement close"
            elif days_until_due is not None and days_until_due <= 5 and due > 0:
                priority = "high"
                alert_level = "warning"
                alert_text = f"Due date in {days_until_due} day(s)."
                recommended_action = "pay at least statement balance to avoid interest"
            elif util >= 30:
                priority = "medium"
                alert_level = "warning"
                alert_text = "Utilization above 30%."
                recommended_action = "pay down before statement closes"

            recommendations.append({
                "account_id": c.id,
                "account_name": c.account_name,
                "payable_now": float(round(due, 2)),
                "estimated_utilization_pct": float(round(util, 2)),
                "target_statement_balance": float(round(target_balance, 2)),
                "pay_before_statement": float(round(pay_before_statement, 2)),
                "statement_day": statement_day,
                "due_day": due_day,
                "days_until_statement": days_until_statement,
                "days_until_due": days_until_due,
                "priority": priority,
                "alert_level": alert_level,
                "alert_text": alert_text,
                "recommended_action": recommended_action,
            })

            if alert_level in ["critical", "warning", "needs_setup"]:
                warnings.append({
                    "account_id": c.id,
                    "account_name": c.account_name,
                    "level": alert_level,
                    "message": alert_text or recommended_action,
                })

        recommendations.sort(
            key=lambda x: (
                {"critical": 3, "warning": 2, "needs_setup": 1, "ok": 0}.get(x["alert_level"], 0),
                x["payable_now"],
            ),
            reverse=True,
        )

        warnings.sort(key=lambda x: {"critical": 3, "warning": 2, "needs_setup": 1}.get(x["level"], 0), reverse=True)

        return Response({
            "total_credit_card_due": float(round(total_due, 2)),
            "warnings": warnings,
            "cards": recommendations,
        })

    @action(detail=False, methods=["post"])
    def reconcile(self, request):
        user_accounts = request.user.accounts.all()
        txns = Transaction.objects.filter(account__in=user_accounts).order_by('date','id')
        duplicates = 0
        refunds_marked = 0
        seen = {}
        by_abs = defaultdict(list)
        for t in txns:
            key = (t.account_id, (t.name or '').strip().lower(), t.date, str(t.amount))
            if key in seen and not t.is_transfer:
                t.category = 'Duplicate'
                t.save(update_fields=['category','updated_at'])
                duplicates += 1
            else:
                seen[key] = t.id
            by_abs[(t.account_id, abs(Decimal(str(t.amount))))].append(t)

        for _, group in by_abs.items():
            neg = [g for g in group if Decimal(str(g.amount)) < 0]
            pos = [g for g in group if Decimal(str(g.amount)) > 0]
            if neg and pos:
                for p in pos:
                    if (p.category or '').lower() in ('uncategorized',''):
                        p.category = 'Refund'
                        p.save(update_fields=['category','updated_at'])
                        refunds_marked += 1

        return Response({"duplicates_marked": duplicates, "refunds_marked": refunds_marked})

    @action(detail=False, methods=["get"])
    def today_overview(self, request):
        today = now().date()
        week_end = today + timedelta(days=7)
        user_accounts = request.user.accounts.all()
        today_txns = Transaction.objects.filter(account__in=user_accounts, date=today).order_by('-id')
        upcoming = Transaction.objects.filter(account__in=user_accounts, date__gt=today, date__lte=week_end).order_by('date')[:20]
        unc_count = Transaction.objects.filter(account__in=user_accounts).filter(models.Q(category__isnull=True)|models.Q(category='')|models.Q(category__iexact='uncategorized')).count()
        outflow = today_txns.filter(amount__lt=0, is_transfer=False).aggregate(v=models.Sum('amount')).get('v') or Decimal('0')
        inflow = today_txns.filter(amount__gt=0, is_transfer=False).aggregate(v=models.Sum('amount')).get('v') or Decimal('0')
        items = [{
            'id': t.id, 'date': str(t.date), 'name': t.name, 'merchant_canonical': canonical_merchant(t.merchant_name or t.name),
            'amount': str(t.amount), 'category': t.category or 'Uncategorized', 'is_transfer': t.is_transfer
        } for t in today_txns[:30]]
        upcoming_items = [{
            'id': t.id, 'date': str(t.date), 'name': t.name, 'amount': str(t.amount), 'category': t.category or 'Uncategorized'
        } for t in upcoming]
        return Response({
            'date': str(today),
            'today_spend': float(abs(outflow)),
            'today_income': float(inflow),
            'uncategorized_count': unc_count,
            'today_transactions': items,
            'upcoming_7d': upcoming_items,
        })

    @action(detail=True, methods=["post"])
    def upload_evidence(self, request, pk=None):
        transaction_obj = self.get_object()
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=400)

        evidence_type = request.data.get("evidence_type", TransactionEvidence.EVIDENCE_OTHER)
        allowed_types = {choice[0] for choice in TransactionEvidence.EVIDENCE_TYPE_CHOICES}
        if evidence_type not in allowed_types:
            evidence_type = TransactionEvidence.EVIDENCE_OTHER

        evidence = TransactionEvidence.objects.create(
            transaction=transaction_obj,
            user=request.user,
            file=uploaded_file,
            original_filename=getattr(uploaded_file, "name", None),
            content_type=getattr(uploaded_file, "content_type", None),
            evidence_type=evidence_type,
            status=TransactionEvidence.STATUS_PENDING,
        )

        return Response(
            {
                "evidence": TransactionEvidenceSerializer(evidence).data,
                "transaction_id": transaction_obj.id,
                "status": "uploaded",
            },
            status=201,
        )

    @action(detail=True, methods=["post"])
    def extract_items(self, request, pk=None):
        transaction_obj = self.get_object()
        evidence_id = request.data.get("evidence_id")

        evidence_qs = TransactionEvidence.objects.filter(
            transaction=transaction_obj, user=request.user
        )
        if evidence_id:
            evidence_qs = evidence_qs.filter(id=evidence_id)

        evidence = evidence_qs.order_by("-created_at").first()
        if not evidence:
            return Response(
                {"error": "No evidence found for this transaction"},
                status=404,
            )

        file_path = getattr(evidence.file, "path", None)
        if not file_path or not os.path.exists(file_path):
            evidence.status = TransactionEvidence.STATUS_FAILED
            evidence.metadata = {"error": "Uploaded file not found on server"}
            evidence.save(update_fields=["status", "metadata", "updated_at"])
            return Response({"error": "Evidence file not found"}, status=400)

        extracted_text, parser_used = extract_evidence_text(
            file_path, evidence.original_filename or evidence.file.name
        )
        evidence.ocr_text = extracted_text
        evidence.parser_used = parser_used

        parsed_items = parse_itemized_text(
            extracted_text,
            merchant_name=transaction_obj.merchant_name or transaction_obj.name,
            transaction_date=transaction_obj.date,
        )

        with db_transaction.atomic():
            TransactionExtractedItem.objects.filter(
                transaction=transaction_obj, evidence=evidence
            ).delete()

            created_items = []
            for item in parsed_items:
                created_items.append(
                    TransactionExtractedItem.objects.create(
                        transaction=transaction_obj,
                        evidence=evidence,
                        name=item["name"],
                        quantity=item.get("quantity", Decimal("1.00")),
                        unit_price=item.get("unit_price"),
                        line_total=item.get("line_total", Decimal("0.00")),
                        merchant_name=transaction_obj.merchant_name,
                        item_date=item.get("item_date") or transaction_obj.date,
                        raw_line=item.get("raw_line"),
                        confidence=item.get("confidence", 0.5),
                    )
                )

            evidence.status = (
                TransactionEvidence.STATUS_PROCESSED
                if created_items
                else TransactionEvidence.STATUS_FAILED
            )
            evidence.metadata = {
                "items_extracted": len(created_items),
                "merchant": transaction_obj.merchant_name or transaction_obj.name,
            }
            evidence.save(
                update_fields=[
                    "ocr_text",
                    "parser_used",
                    "status",
                    "metadata",
                    "updated_at",
                ]
            )

        return Response(
            {
                "transaction_id": transaction_obj.id,
                "evidence": TransactionEvidenceSerializer(evidence).data,
                "items": TransactionExtractedItemSerializer(created_items, many=True).data,
                "count": len(created_items),
            }
        )

    @action(detail=True, methods=["post"])
    def clear_extracted_items(self, request, pk=None):
        transaction_obj = self.get_object()
        evidence_id = request.data.get("evidence_id")
        clear_evidence = bool(request.data.get("clear_evidence", False))

        item_qs = TransactionExtractedItem.objects.filter(transaction=transaction_obj)
        if evidence_id:
            item_qs = item_qs.filter(evidence_id=evidence_id)

        item_count = item_qs.count()
        item_qs.delete()

        evidence_deleted = 0
        if clear_evidence:
            ev_qs = TransactionEvidence.objects.filter(transaction=transaction_obj)
            if evidence_id:
                ev_qs = ev_qs.filter(id=evidence_id)
            evidence_deleted = ev_qs.count()
            ev_qs.delete()

        return Response({
            "transaction_id": transaction_obj.id,
            "cleared_items": item_count,
            "cleared_evidence": evidence_deleted,
        })

    @action(detail=True, methods=["get"])
    def extracted_items(self, request, pk=None):
        transaction_obj = self.get_object()
        qs = TransactionExtractedItem.objects.filter(transaction=transaction_obj).order_by("-created_at")

        evidence_id = request.query_params.get("evidence_id")
        if evidence_id:
            qs = qs.filter(evidence_id=evidence_id)

        return Response(
            {
                "transaction_id": transaction_obj.id,
                "count": qs.count(),
                "items": TransactionExtractedItemSerializer(qs, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def item_search(self, request):
        user_accounts = request.user.accounts.all()
        qs = TransactionExtractedItem.objects.filter(
            transaction__account__in=user_accounts
        ).select_related("transaction", "evidence")

        q = (request.query_params.get("q") or "").strip()
        merchant = (request.query_params.get("merchant") or "").strip()
        transaction_id = request.query_params.get("transaction_id")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if q:
            qs = qs.filter(
                models.Q(name__icontains=q)
                | models.Q(raw_line__icontains=q)
                | models.Q(transaction__name__icontains=q)
            )

        if merchant:
            qs = qs.filter(
                models.Q(merchant_name__icontains=merchant)
                | models.Q(transaction__merchant_name__icontains=merchant)
            )

        if transaction_id:
            qs = qs.filter(transaction_id=transaction_id)

        if date_from:
            parsed = self._parse_date_value(date_from)
            if parsed:
                qs = qs.filter(transaction__date__gte=parsed)

        if date_to:
            parsed = self._parse_date_value(date_to)
            if parsed:
                qs = qs.filter(transaction__date__lte=parsed)

        qs = qs.order_by("-transaction__date", "-created_at")[:100]

        return Response(
            {
                "count": len(qs),
                "items": TransactionExtractedItemSerializer(qs, many=True).data,
            }
        )


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CategorizationRuleViewSet(viewsets.ModelViewSet):
    serializer_class = CategorizationRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CategorizationRule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class RecurringTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RecurringTransaction.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["post"])
    def scan(self, request):
        """
        Trigger a full scan of transaction history to detect subscriptions
        and update statuses of existing ones.
        """
        service = SubscriptionService()

        # 1. Detect new subscriptions
        new_found = service.detect_subscriptions(request.user)

        # 2. Update status of existing ones (check for overdue/discontinued)
        updated_count = service.update_statuses(request.user)

        return Response(
            {
                "status": "success",
                "new_subscriptions_found": new_found,
                "statuses_updated": updated_count,
            }
        )

    def destroy(self, request, *args, **kwargs):
        """
        Delete a recurring subscription and add it to the exclusion list
        so it doesn't get auto-detected again.
        """
        from .models import RecurringTransactionExclusion

        instance = self.get_object()
        user = request.user

        # Add to exclusion list
        RecurringTransactionExclusion.objects.get_or_create(
            user=user, name_pattern=instance.name
        )

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"])
    def calendar_events(self, request):
        """
        Get recurring transactions as calendar events for a date range.
        Defaults to current month if no range provided.
        """
        from datetime import date, timedelta
        import calendar

        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")

        today = date.today()

        if start_str:
            start_date = date.fromisoformat(start_str)
        else:
            start_date = today.replace(day=1)  # First day of current month

        if end_str:
            end_date = date.fromisoformat(end_str)
        else:
            # Last day of current month
            last_day = calendar.monthrange(today.year, today.month)[1]
            end_date = today.replace(day=last_day)

        events = []
        subs = self.get_queryset().filter(status="active")

        # Helper for month addition
        def add_months(d, months):
            month = d.month - 1 + months
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, calendar.monthrange(year, month)[1])
            return date(year, month, day)

        for sub in subs:
            if not sub.next_due_date:
                continue

            current = sub.next_due_date

            # Use 'effective_date' iterator
            # Retract if next_due_date is far in future? No, likely it's correct.
            # If next_due_date is in past, start from there.

            limit = 0
            while limit < 100:
                if current > end_date:
                    break

                if current >= start_date:
                    events.append(
                        {
                            "id": f"{sub.id}_{current}",
                            "title": sub.name,
                            "date": current,
                            "amount": sub.amount,
                            "type": "bill",
                            "status": sub.status,
                        }
                    )

                # Advance
                if sub.frequency == "weekly":
                    current += timedelta(weeks=1)
                elif sub.frequency == "monthly":
                    current = add_months(current, 1)
                elif sub.frequency == "yearly":
                    current = add_months(current, 12)
                else:
                    break

                limit += 1

        return Response(events)

    @action(detail=False, methods=["get"])
    def insights(self, request):
        """Get smart insights."""
        service = SubscriptionService()
        insights = service.get_insights(request.user)
        return Response(insights)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """Get recurring transactions due in the next 30 days."""
        today = date.today()
        next_month = today + timedelta(days=30)

        upcoming = (
            self.get_queryset()
            .filter(
                is_active=True, next_due_date__gte=today, next_due_date__lte=next_month
            )
            .order_by("next_due_date")
        )

        serializer = self.get_serializer(upcoming, many=True)
        return Response(serializer.data)


from .models import SavingsGoal
from .serializers import SavingsGoalSerializer


class SavingsGoalViewSet(viewsets.ModelViewSet):
    serializer_class = SavingsGoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavingsGoal.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def add_funds(self, request, pk=None):
        """Add funds to a savings goal."""
        goal = self.get_object()
        amount = request.data.get("amount", 0)

        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount"}, status=400)

        goal.current_amount += Decimal(str(amount))

        # Auto-complete if target reached
        if goal.current_amount >= goal.target_amount:
            goal.is_completed = True

        goal.save()

        serializer = self.get_serializer(goal)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def withdraw(self, request, pk=None):
        """Withdraw funds from a savings goal."""
        goal = self.get_object()
        amount = request.data.get("amount", 0)

        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return Response({"error": "Invalid amount"}, status=400)

        goal.current_amount = max(0, goal.current_amount - Decimal(str(amount)))
        goal.is_completed = False  # Reopen if withdrawing
        goal.save()

        serializer = self.get_serializer(goal)
        return Response(serializer.data)
