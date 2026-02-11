from django.utils.timezone import now
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Transaction
from .serializers import TransactionSerializer
from rest_framework import viewsets, status
from datetime import datetime
from django.db import models, transaction as db_transaction
import os
import openai
from dotenv import load_dotenv
from .services import TransferService

load_dotenv()


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

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

    @action(detail=False, methods=["post"])
    def categorize_with_ai(self, request):
        """
        Use AI to categorize transactions based on their descriptions.
        Accepts a list of transaction descriptions and returns suggested categories.
        If transaction_ids are provided, will also update the transactions in the database.
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

            # Fetch all categories (system + user's own)
            from categories.models import Category
            from django.db.models import Q

            all_categories = Category.objects.filter(
                Q(is_system=True) | Q(user=request.user)
            ).values_list("name", flat=True)
            categories_list = list(all_categories)
            categories_list_str = ", ".join(categories_list)
            allowed_categories = {
                name.lower(): name for name in categories_list if isinstance(name, str)
            }
            if "uncategorized" not in allowed_categories:
                allowed_categories["uncategorized"] = "Uncategorized"

            import json
            import re

            def iter_batches(items, size):
                for idx in range(0, len(items), size):
                    yield idx, items[idx : idx + size]

            all_categories = []
            updated_count = 0

            print(f"[AI Categorization DEBUG] Input count: {len(descriptions)}")
            print(f"[AI Categorization DEBUG] Raw descriptions: {descriptions}")

            batch_size = 25
            for offset, batch in iter_batches(descriptions, batch_size):
                descriptions_text = "\n".join(
                    [f"{i + 1}. {desc}" for i, desc in enumerate(batch)]
                )
                prompt = f"""You are a financial transaction categorizer. Categorize the following transaction descriptions into appropriate financial categories from the provided list.

Available Categories: {categories_list_str}

For each transaction, provide ONLY the category name (no explanation, no quotes, just the category name). If none fit perfectly, choose 'Uncategorized' or the closest match.

Transactions:
{descriptions_text}

Return the categories as a JSON array in the same order as the transactions, with one category per transaction. Format: ["Category1", "Category2", ...]"""

                max_tokens = min(1200, 60 * len(batch) + 200)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a financial transaction categorizer. Return only valid JSON arrays.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.3,
                    max_tokens=max_tokens,
                )

                categories_text = response.choices[0].message.content.strip()

                print("\n" + "=" * 60)
                print(
                    f"[AI Categorization DEBUG] RAW PROMPT (batch {offset // batch_size + 1}):"
                )
                print("-" * 60)
                print(prompt)
                print("-" * 60)
                print("[AI Categorization DEBUG] RAW AI OUTPUT:")
                print("-" * 60)
                print(categories_text)
                print("=" * 60 + "\n")

                json_match = re.search(r"\[.*\]", categories_text, re.DOTALL)
                if json_match:
                    categories = json.loads(json_match.group())
                else:
                    categories = json.loads(categories_text)

                if not isinstance(categories, list):
                    return Response(
                        {
                            "error": "Invalid response format from AI",
                            "batch_offset": offset,
                            "batch_size": len(batch),
                            "output_length": None,
                        },
                        status=500,
                    )

                if len(categories) != len(batch):
                    print(
                        f"[AI Categorization DEBUG] Length mismatch: "
                        f"expected {len(batch)}, got {len(categories)}"
                    )
                    if len(categories) > len(batch):
                        categories = categories[: len(batch)]
                    else:
                        categories = categories + ["Uncategorized"] * (
                            len(batch) - len(categories)
                        )

                normalized_categories = []
                for category in categories:
                    if not isinstance(category, str):
                        normalized_categories.append("Uncategorized")
                        continue
                    trimmed = category.strip()
                    if not trimmed:
                        normalized_categories.append("Uncategorized")
                        continue
                    mapped = allowed_categories.get(trimmed.lower())
                    if not mapped:
                        print(
                            f"[AI Categorization DEBUG] Unknown category '{trimmed}', defaulting to Uncategorized"
                        )
                        normalized_categories.append("Uncategorized")
                    else:
                        normalized_categories.append(mapped)

                categories = normalized_categories

                print(
                    f"[AI Categorization DEBUG] Parsed categories (batch {offset // batch_size + 1}): {categories}"
                )
                all_categories.extend(categories)

                if auto_update and transaction_ids:
                    user = request.user
                    user_accounts = user.accounts.all()
                    batch_ids = transaction_ids[offset : offset + len(batch)]
                    if len(batch_ids) == len(categories):
                        for txn_id, category in zip(batch_ids, categories):
                            try:
                                transaction = Transaction.objects.filter(
                                    id=txn_id, account__in=user_accounts
                                ).first()
                                if transaction:
                                    transaction.category = category
                                    transaction.save()
                                    updated_count += 1
                            except Exception as e:
                                print(
                                    f"[AI Categorization] Error updating transaction {txn_id}: {str(e)}"
                                )

            print(f"[AI Categorization DEBUG] Raw categories output: {all_categories}")

            return Response(
                {
                    "categories": all_categories,
                    "updated_count": updated_count if auto_update else 0,
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


from .models import Tag
from .serializers import TagSerializer


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Tag.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


from .models import CategorizationRule
from .serializers import CategorizationRuleSerializer


class CategorizationRuleViewSet(viewsets.ModelViewSet):
    serializer_class = CategorizationRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CategorizationRule.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


from .models import RecurringTransaction
from .serializers import RecurringTransactionSerializer
from collections import defaultdict
from datetime import date


from .services import SubscriptionService


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
