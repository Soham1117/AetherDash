import threading
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import BankStatement, ImportedTransaction
from .serializers import BankStatementSerializer, ImportedTransactionSerializer

from transactions.models import Transaction
from accounts.models import Account

class BankStatementViewSet(viewsets.ModelViewSet):
    serializer_class = BankStatementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BankStatement.objects.filter(user=self.request.user).order_by('-upload_date')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['post'])
    def upload(self, request):
        if 'file' not in request.FILES and 'files' not in request.FILES:
             return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        # Support both single 'file' and multiple 'files'
        files = request.FILES.getlist('files')
        if not files and 'file' in request.FILES:
            files = [request.FILES['file']]
            
        account_id = request.data.get('account_id')
        target_account = None
        if account_id:
            target_account = Account.objects.filter(id=account_id, user=request.user).first()

        created_statements = []

        for file_obj in files:
            statement = BankStatement.objects.create(
                user=request.user,
                file=file_obj,
                original_filename=file_obj.name,
                target_account=target_account
            )
            created_statements.append(statement)

            # Run processing in background for EACH file
            def run_import(s_id):
                try:
                    from .models import BankStatement
                    from .services import ImportService
                    s = BankStatement.objects.get(id=s_id)
                    service = ImportService(s)
                    service.process()
                except Exception as e:
                    print(f"Error in import thread: {e}")

            threading.Thread(target=run_import, args=(statement.id,), daemon=True).start()

        return Response(BankStatementSerializer(created_statements, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Commit selected transactions to the main ledger.
        Expects: { "transaction_ids": [1, 2, 3], "account_id": 5 }
        account_id is optional if target_account already set.
        """
        statement = self.get_object()

        if statement.status != BankStatement.STATUS_REVIEW:
            return Response({'error': 'Statement is not in review state'}, status=status.HTTP_400_BAD_REQUEST)

        ids_to_confirm = request.data.get('transaction_ids', [])
        account_id = request.data.get('account_id')

        # If account_id provided, update the statement's target_account
        if account_id:
            try:
                target_account = Account.objects.get(id=account_id, user=request.user)
                statement.target_account = target_account
                statement.save()
                print(f"[Import Confirm] Updated target account to: {target_account.account_name}")
            except Account.DoesNotExist:
                return Response({'error': 'Invalid account ID'}, status=status.HTTP_400_BAD_REQUEST)

        if ids_to_confirm:
            to_import = statement.transactions.filter(id__in=ids_to_confirm, selected_for_import=True)
        else:
            # Import all marked as selected
            to_import = statement.transactions.filter(selected_for_import=True)

        if not statement.target_account:
             return Response({'error': 'Target account is required. Please select an account.'}, status=status.HTTP_400_BAD_REQUEST)

        created_count = 0
        for imp in to_import:
            name_raw = (imp.description or "").strip()
            max_len = Transaction._meta.get_field("name").max_length
            if len(name_raw) > max_len:
                print(f"[Import Confirm] Truncating description for ImportedTransaction {imp.id} from {len(name_raw)} to {max_len}")
                name_raw = name_raw[:max_len]
            if not name_raw:
                name_raw = "Transaction"
            Transaction.objects.create(
                account=statement.target_account,
                amount=imp.amount,
                date=imp.date,
                name=name_raw,
                category='Uncategorized' # Default, or run categorization rules here
            )
            created_count += 1

        statement.status = BankStatement.STATUS_COMPLETED
        statement.save()

        print(f"[Import Confirm] Successfully imported {created_count} transactions to {statement.target_account.account_name}")

        return Response({'status': 'Imported', 'count': created_count})

    @action(detail=True, methods=['patch'])
    def update_selection(self, request, pk=None):
        """
        Update selected_for_import status for transactions.
        Expects: { "transactions": [{ "id": 1, "selected": false }] }
        """
        statement = self.get_object()
        updates = request.data.get('transactions', [])
        
        for update in updates:
            t_id = update.get('id')
            sel = update.get('selected')
            if t_id is not None and sel is not None:
                statement.transactions.filter(id=t_id).update(selected_for_import=sel)
        
        return Response({'status': 'Updated'})

    @action(detail=True, methods=['patch'], url_path='transaction/(?P<transaction_id>\\d+)')
    def patch_transaction(self, request, pk=None, transaction_id=None):
        statement = self.get_object()
        try:
            txn = statement.transactions.get(id=transaction_id)
        except ImportedTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)
            
        # Update fields
        if 'date' in request.data:
            txn.date = request.data['date']
        if 'amount' in request.data:
            txn.amount = request.data['amount']
        if 'description' in request.data:
            txn.description = request.data['description']
        if 'selected_for_import' in request.data:
            txn.selected_for_import = request.data['selected_for_import']
            
        txn.save()
        return Response(ImportedTransactionSerializer(txn).data)
