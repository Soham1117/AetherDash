import calendar
from datetime import date

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Account, CreditCardProfile
from .serializers import AccountSerializer, CreditCardProfileSerializer
from transactions.models import Transaction


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Return accounts with Plaid-synced balance directly
        return Account.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def clear_transactions(self, request, pk=None):
        """
        Delete all transactions for this account and reset balance to 0.
        """
        account = self.get_object()

        # Delete transactions
        count, _ = Transaction.objects.filter(account=account).delete()

        # Reset balance
        account.balance = 0
        account.save()

        return Response(
            {"status": "cleared", "deleted_count": count}, status=status.HTTP_200_OK
        )


class CreditCardProfileViewSet(viewsets.ModelViewSet):
    serializer_class = CreditCardProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CreditCardProfile.objects.filter(user=self.request.user).select_related("account")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @staticmethod
    def _days_until_day_of_month(day, today=None):
        if day is None:
            return None
        today = today or date.today()
        day = int(day)
        if day < 1 or day > 31:
            return None

        year = today.year
        month = today.month

        while True:
            last_day = calendar.monthrange(year, month)[1]
            actual_day = min(day, last_day)
            candidate = date(year, month, actual_day)
            if candidate >= today:
                return (candidate - today).days
            if month == 12:
                month = 1
                year += 1
            else:
                month += 1

    @action(detail=False, methods=["post"])
    def upsert(self, request):
        account_id = request.data.get("account") or request.data.get("account_id")
        if not account_id:
            return Response({"detail": "account/account_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = Account.objects.get(id=account_id, user=request.user, account_type="credit_card")
        except Account.DoesNotExist:
            return Response({"detail": "Credit card account not found."}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = CreditCardProfile.objects.get_or_create(
            user=request.user,
            account=account,
            defaults={
                "credit_limit": 0,
                "target_statement_utilization_pct": 6.0,
                "notes": "",
            },
        )

        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user, account=account)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"])
    def usage_checker(self, request):
        profiles = self.get_queryset()
        rows = []
        total_pre_statement_paydown = 0.0
        warnings = []

        for p in profiles:
            limit = float(p.credit_limit or 0)
            bal = float(p.account.balance or 0)
            tgt_pct = float(p.target_statement_utilization_pct or 6.0)
            target_balance = round(limit * (tgt_pct / 100.0), 2) if limit > 0 else 0.0
            paydown = round(max(0.0, bal - target_balance), 2)
            total_pre_statement_paydown += paydown
            current_util = round((bal / limit * 100.0), 2) if limit > 0 else 0.0

            days_until_statement = self._days_until_day_of_month(p.statement_day)
            days_until_due = self._days_until_day_of_month(p.due_day)

            warning_level = "ok"
            warning_text = ""
            if limit <= 0:
                warning_level = "needs_setup"
                warning_text = "Set credit limit for accurate utilization guidance."
            elif current_util >= 80:
                warning_level = "critical"
                warning_text = "Very high utilization. Pay immediately to reduce credit score impact."
            elif days_until_statement is not None and days_until_statement <= 3 and paydown > 0:
                warning_level = "warning"
                warning_text = f"Statement closes in {days_until_statement} day(s). Pay {paydown:.2f} before close."
            elif days_until_due is not None and days_until_due <= 5 and bal > 0:
                warning_level = "warning"
                warning_text = f"Payment due in {days_until_due} day(s). Avoid interest by paying current balance."
            elif current_util >= 30:
                warning_level = "warning"
                warning_text = "Utilization above 30%. Consider a paydown before statement close."

            if warning_level in {"warning", "critical", "needs_setup"}:
                warnings.append({
                    "account_id": p.account_id,
                    "account_name": p.account.account_name,
                    "level": warning_level,
                    "message": warning_text,
                })

            rows.append({
                "account_id": p.account_id,
                "account_name": p.account.account_name,
                "credit_limit": limit,
                "current_balance": bal,
                "current_utilization_pct": current_util,
                "target_statement_utilization_pct": tgt_pct,
                "target_statement_balance": target_balance,
                "pay_before_statement": paydown,
                "statement_day": p.statement_day,
                "due_day": p.due_day,
                "days_until_statement": days_until_statement,
                "days_until_due": days_until_due,
                "warning_level": warning_level,
                "warning_text": warning_text,
                "notes": p.notes,
            })

        rows.sort(key=lambda x: (x["warning_level"] in ["critical", "warning"], x["pay_before_statement"]), reverse=True)
        warnings.sort(key=lambda x: {"critical": 3, "warning": 2, "needs_setup": 1}.get(x["level"], 0), reverse=True)

        return Response({
            "target_utilization_pct_default": 6.0,
            "total_pre_statement_paydown": round(total_pre_statement_paydown, 2),
            "warnings": warnings,
            "cards": rows,
        })
