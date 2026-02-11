from datetime import timedelta
from decimal import Decimal
from .models import Transaction
import re

# Common patterns that indicate a credit card payment
CC_PAYMENT_PATTERNS = [
    r"payment\s*[-–—]?\s*thank\s*you",  # "PAYMENT - THANK YOU", "PAYMENT THANK YOU"
    r"autopay\s*payment",  # "AUTOPAY PAYMENT"
    r"automatic\s*payment",  # "AUTOMATIC PAYMENT"
    r"online\s*payment",  # "ONLINE PAYMENT"
    r"mobile\s*payment",  # "MOBILE PAYMENT"
    r"ach\s*payment",  # "ACH PAYMENT"
    r"payment\s*received",  # "PAYMENT RECEIVED"
    r"payment\s*from",  # "PAYMENT FROM CHECKING"
    r"credit\s*card\s*payment",  # "CREDIT CARD PAYMENT"
    r"card\s*payment",  # "CARD PAYMENT"
    r"bill\s*payment",  # "BILL PAYMENT"
    r"epay",  # "EPAY", "EPAYMENT"
    r"web\s*payment",  # "WEB PAYMENT"
    r"internet\s*payment",  # "INTERNET PAYMENT"
    r"^payment$",  # Just "PAYMENT"
]

# Patterns for bank-side transfers (the source of the payment)
BANK_TRANSFER_PATTERNS = [
    r"transfer\s*to",  # "TRANSFER TO CHASE"
    r"online\s*transfer",  # "ONLINE TRANSFER"
    r"ach\s*transfer",  # "ACH TRANSFER"
    r"bill\s*pay",  # "BILL PAY CHASE CARD"
    r"payment\s*to",  # "PAYMENT TO CREDIT CARD"
]


def is_cc_payment_by_name(name):
    """Check if transaction name matches CC payment patterns."""
    if not name:
        return False
    name_lower = name.lower().strip()
    for pattern in CC_PAYMENT_PATTERNS:
        if re.search(pattern, name_lower):
            return True
    return False


def is_bank_transfer_by_name(name):
    """Check if transaction name matches bank transfer patterns."""
    if not name:
        return False
    name_lower = name.lower().strip()
    for pattern in BANK_TRANSFER_PATTERNS:
        if re.search(pattern, name_lower):
            return True
    return False


class TransferService:
    def detect_transfers(self, user):
        """
        Scans all transactions for the user to find unmatched transfers.
        Uses multiple detection methods:
        1. Exact amount matching (original logic)
        2. Credit card payment name pattern detection
        3. Bank transfer name pattern detection

        Returns a tuple: (count, list_of_matches)
        """
        # Get potential transfer candidates (not yet marked)
        candidates = (
            Transaction.objects.filter(account__user=user, is_transfer=False)
            .select_related("account")
            .order_by("date")
        )

        matches_found = 0
        matches_details = []
        processed_ids = set()

        # PHASE 1: Detect CC payments by name pattern on credit card accounts
        cc_payments_marked = self._detect_cc_payments_by_name(
            user, candidates, processed_ids, matches_details
        )
        matches_found += cc_payments_marked

        # PHASE 2: Detect bank transfers by name pattern
        bank_transfers_marked = self._detect_bank_transfers_by_name(
            user, candidates, processed_ids, matches_details
        )
        matches_found += bank_transfers_marked

        # PHASE 3: Original exact-match logic for remaining candidates
        exact_matches = self._detect_exact_amount_matches(
            user, candidates, processed_ids, matches_details
        )
        matches_found += exact_matches

        return matches_found, matches_details

    def _detect_cc_payments_by_name(
        self, user, candidates, processed_ids, matches_details
    ):
        """Detect credit card payments by analyzing transaction names."""
        count = 0

        for txn in candidates:
            if txn.id in processed_ids:
                continue

            # Check if it's a credit card account
            if txn.account.account_type != "credit_card":
                continue

            # Check if the name matches CC payment patterns
            if not is_cc_payment_by_name(txn.name):
                continue

            # CC payments are typically positive (reduces debt)
            # In our system: positive = credit (money coming in to reduce debt)
            if txn.amount <= 0:
                continue

            # This looks like a CC payment - mark it as transfer
            try:
                txn.refresh_from_db()
                if txn.is_transfer:
                    continue

                txn.is_transfer = True
                txn.category = "Transfer"
                txn.save()
                processed_ids.add(txn.id)
                count += 1

                # Try to find matching bank-side transaction
                bank_match = self._find_bank_payment_match(user, txn, processed_ids)

                matches_details.append(
                    {
                        "type": "cc_payment_detected",
                        "source": {
                            "id": txn.id,
                            "name": txn.name,
                            "amount": str(txn.amount),
                            "account": txn.account.account_name,
                        },
                        "destination": bank_match,
                        "date": str(txn.date),
                        "detection_method": "name_pattern",
                    }
                )

            except Transaction.DoesNotExist:
                continue

        return count

    def _find_bank_payment_match(self, user, cc_payment, processed_ids):
        """Try to find the corresponding bank-side transaction for a CC payment."""
        # Search window: payment could have been initiated a few days before
        start_date = cc_payment.date - timedelta(days=5)
        end_date = cc_payment.date + timedelta(days=2)

        # Look for matching amount from bank accounts
        target_amount = -cc_payment.amount  # Bank side is negative (outflow)

        potential_matches = (
            Transaction.objects.filter(
                account__user=user,
                is_transfer=False,
                date__range=(start_date, end_date),
            )
            .exclude(account__account_type="credit_card")
            .exclude(id__in=processed_ids)
        )

        # First try exact amount match
        exact_match = potential_matches.filter(amount=target_amount).first()
        if exact_match:
            exact_match.is_transfer = True
            exact_match.category = "Transfer"
            exact_match.transfer_match = cc_payment
            exact_match.save()

            cc_payment.transfer_match = exact_match
            cc_payment.save()

            processed_ids.add(exact_match.id)
            return {
                "id": exact_match.id,
                "name": exact_match.name,
                "amount": str(exact_match.amount),
                "account": exact_match.account.account_name,
                "match_type": "exact_amount",
            }

        # Try name pattern match with similar amount (within 5%)
        for match in potential_matches:
            if is_bank_transfer_by_name(match.name) or "payment" in match.name.lower():
                amount_diff = abs(abs(match.amount) - abs(cc_payment.amount))
                amount_tolerance = abs(cc_payment.amount) * Decimal(
                    "0.05"
                )  # 5% tolerance

                if amount_diff <= amount_tolerance:
                    match.is_transfer = True
                    match.category = "Transfer"
                    match.transfer_match = cc_payment
                    match.save()

                    cc_payment.transfer_match = match
                    cc_payment.save()

                    processed_ids.add(match.id)
                    return {
                        "id": match.id,
                        "name": match.name,
                        "amount": str(match.amount),
                        "account": match.account.account_name,
                        "match_type": "name_pattern_fuzzy_amount",
                    }

        return None

    def _detect_bank_transfers_by_name(
        self, user, candidates, processed_ids, matches_details
    ):
        """Detect bank-side transfers by name patterns."""
        count = 0

        for txn in candidates:
            if txn.id in processed_ids:
                continue

            # Skip credit cards - we handle those in CC payment detection
            if txn.account.account_type == "credit_card":
                continue

            # Check if it matches bank transfer patterns
            if not is_bank_transfer_by_name(txn.name):
                continue

            # Bank transfers out are negative
            if txn.amount >= 0:
                continue

            try:
                txn.refresh_from_db()
                if txn.is_transfer:
                    continue

                txn.is_transfer = True
                txn.category = "Transfer"
                txn.save()
                processed_ids.add(txn.id)
                count += 1

                matches_details.append(
                    {
                        "type": "bank_transfer_detected",
                        "source": {
                            "id": txn.id,
                            "name": txn.name,
                            "amount": str(txn.amount),
                            "account": txn.account.account_name,
                        },
                        "destination": None,
                        "date": str(txn.date),
                        "detection_method": "name_pattern",
                    }
                )

            except Transaction.DoesNotExist:
                continue

        return count

    def _detect_exact_amount_matches(
        self, user, candidates, processed_ids, matches_details
    ):
        """Original exact-match detection for general transfers."""
        count = 0

        for txn in candidates:
            if txn.id in processed_ids:
                continue

            try:
                txn.refresh_from_db()
            except Transaction.DoesNotExist:
                continue

            if txn.is_transfer:
                continue

            # Define search window (+/- 3 days)
            start_date = txn.date - timedelta(days=3)
            end_date = txn.date + timedelta(days=3)

            # Target amount (opposite sign)
            target_amount = -txn.amount

            # Find match
            match = (
                Transaction.objects.filter(
                    account__user=user,
                    is_transfer=False,
                    amount=target_amount,
                    date__range=(start_date, end_date),
                )
                .exclude(id=txn.id)
                .exclude(id__in=processed_ids)
                .first()
            )

            if match:
                # Link them
                txn.is_transfer = True
                txn.transfer_match = match
                txn.category = "Transfer"
                txn.save()

                match.is_transfer = True
                match.transfer_match = txn
                match.category = "Transfer"
                match.save()

                processed_ids.add(txn.id)
                processed_ids.add(match.id)
                count += 1

                matches_details.append(
                    {
                        "type": "exact_match",
                        "source": {
                            "id": txn.id,
                            "name": txn.name,
                            "amount": str(txn.amount),
                            "account": txn.account.account_name,
                        },
                        "destination": {
                            "id": match.id,
                            "name": match.name,
                            "amount": str(match.amount),
                            "account": match.account.account_name,
                        },
                        "date": str(txn.date),
                        "detection_method": "exact_amount",
                    }
                )

        return count


from collections import defaultdict
from statistics import mean, stdev


class SubscriptionService:
    def detect_subscriptions(self, user):
        """
        Analyzes transaction history to detect recurring subscriptions.
        Returns newly detected subscriptions count.
        """
        # Get all debit transactions, excluding transfers and known one-offs
        transactions = Transaction.objects.filter(
            account__user=user,
            amount__lt=0,  # Expenses are negative
            is_transfer=False,
        ).order_by("date")

        # Group by normalized merchant/name
        groups = defaultdict(list)
        for txn in transactions:
            # Normalize name: "Netflix.com" -> "Netflix"
            key = txn.merchant_name if txn.merchant_name else txn.name
            key = re.sub(r"\d+", "", key).strip()
            groups[key].append(txn)

        detected_count = 0
        detected_count = 0
        from .models import RecurringTransaction, RecurringTransactionExclusion

        # Fetch all exclusions for the user
        excluded_patterns = set(
            RecurringTransactionExclusion.objects.filter(user=user).values_list(
                "name_pattern", flat=True
            )
        )

        for name, txns in groups.items():
            # Check exclusions
            if name in excluded_patterns:
                continue

            if len(txns) < 3:
                continue

            # Sort by date
            txns.sort(key=lambda x: x.date)

            # Calculate intervals
            intervals = []
            for i in range(1, len(txns)):
                delta = (txns[i].date - txns[i - 1].date).days
                intervals.append(delta)

            if not intervals:
                continue

            avg_interval = mean(intervals)
            # Standard deviation to check consistency
            interval_stdev = stdev(intervals) if len(intervals) > 1 else 0

            # Determine frequency
            frequency = None
            if 25 <= avg_interval <= 35 and interval_stdev < 5:
                frequency = "monthly"
            elif 355 <= avg_interval <= 375 and interval_stdev < 10:
                frequency = "yearly"
            elif 6 <= avg_interval <= 8 and interval_stdev < 2:
                frequency = "weekly"

            if frequency:
                # Check consistency of amount (within 10-20% variance)
                amounts = [abs(t.amount) for t in txns]
                avg_amount = mean(amounts)

                # Check if we already have this subscription
                existing = RecurringTransaction.objects.filter(
                    user=user,
                    name__icontains=name,  # Loose match
                    status="active",
                ).first()

                if not existing:
                    # Create new subscription
                    RecurringTransaction.objects.create(
                        user=user,
                        name=name,
                        amount=avg_amount,
                        frequency=frequency,
                        next_due_date=txns[-1].date + timedelta(days=int(avg_interval)),
                        last_transaction_date=txns[-1].date,
                        status="active",
                        detected_by_system=True,
                        category_ref=txns[-1].category_ref
                        if hasattr(txns[-1], "category_ref")
                        else None,
                        merchant_name=txns[-1].merchant_name,
                    )
                    detected_count += 1
                else:
                    # Update existing
                    existing.last_transaction_date = txns[-1].date
                    existing.next_due_date = txns[-1].date + timedelta(
                        days=int(avg_interval)
                    )
                    existing.merchant_name = txns[-1].merchant_name
                    if existing.status in ["discontinued", "overdue"]:
                        existing.status = "active"
                    existing.save()

        return detected_count

    def update_statuses(self, user):
        """
        Checks all active subscriptions and marks them as discontinued if overdue.
        """
        from .models import RecurringTransaction
        from django.utils import timezone

        today = timezone.now().date()
        subs = RecurringTransaction.objects.filter(user=user, status="active")

        updated_count = 0
        for sub in subs:
            if sub.last_transaction_date:
                days_since_last = (today - sub.last_transaction_date).days

                # Check if it has exceeded the grace period for its frequency
                limit = 0
                if sub.frequency == "monthly":
                    limit = 45
                elif sub.frequency == "yearly":
                    limit = 380
                elif sub.frequency == "weekly":
                    limit = 14

                if days_since_last > limit:
                    sub.status = "discontinued"
                    sub.save()
                    updated_count += 1

        return updated_count

    def get_insights(self, user):
        """
        Generate smart insights about subscriptions.
        """
        from .models import RecurringTransaction, Transaction
        from decimal import Decimal

        insights = []
        subs = RecurringTransaction.objects.filter(user=user, status="active")

        for sub in subs:
            # Check for price hikes
            # Get last 5 transactions for this subscription pattern
            query_name = sub.merchant_name or sub.name
            # simplified matching logic similar to detection
            recent_txns = Transaction.objects.filter(
                account__user=user, name__icontains=query_name, amount__lt=0
            ).order_by("-date")[:5]

            if not recent_txns:
                continue

            # If latest transaction is > 5% higher than average of others
            latest = abs(recent_txns[0].amount)
            if len(recent_txns) > 1:
                others = [abs(t.amount) for t in recent_txns[1:]]
                avg_others = sum(others) / len(others)

                if avg_others > 0 and latest > avg_others * Decimal("1.05"):
                    diff = latest - avg_others
                    insights.append(
                        {
                            "id": f"hike_{sub.id}",
                            "type": "price_hike",
                            "title": f"Price Hike: {sub.name}",
                            "message": f"Latest payment (${latest:.2f}) is higher than usual (${avg_others:.2f}).",
                            "severity": "warning",
                            "metric": f"+${diff:.2f}",
                        }
                    )

        return insights
