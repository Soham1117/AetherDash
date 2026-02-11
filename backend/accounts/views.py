from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Account
from .serializers import AccountSerializer
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
