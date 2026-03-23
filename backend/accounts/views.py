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

    @action(detail=False, methods=["get"])
    def usage_checker(self, request):
        profiles = self.get_queryset()
        rows = []
        total_pre_statement_paydown = 0.0
        for p in profiles:
            limit = float(p.credit_limit or 0)
            bal = float(p.account.balance or 0)
            tgt_pct = float(p.target_statement_utilization_pct or 6.0)
            target_balance = round(limit * (tgt_pct / 100.0), 2) if limit > 0 else 0.0
            paydown = round(max(0.0, bal - target_balance), 2)
            total_pre_statement_paydown += paydown
            current_util = round((bal / limit * 100.0), 2) if limit > 0 else 0.0
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
                "notes": p.notes,
            })
        rows.sort(key=lambda x: x["pay_before_statement"], reverse=True)
        return Response({
            "target_utilization_pct_default": 6.0,
            "total_pre_statement_paydown": round(total_pre_statement_paydown, 2),
            "cards": rows,
        })
