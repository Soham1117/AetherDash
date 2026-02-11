from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from accounts.models import Account
from transactions.models import Transaction
from data_import.models import BankStatement, ImportedTransaction
from data_import.services import ImportService
from datetime import date
from decimal import Decimal

User = get_user_model()

class ImportServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.account = Account.objects.create(user=self.user, account_name='Test Account', balance=1000)
        
        # Existing transaction to test deduplication
        self.existing_txn = Transaction.objects.create(
            account=self.account,
            amount=Decimal('-50.00'),
            date=date(2023, 10, 15),
            name='Grocery Store'
        )

    def test_process_csv(self):
        csv_content = b"Date,Description,Amount\n2023-10-15,Grocery Store,-50.00\n2023-10-16,Coffee Shop,-5.00"
        file = SimpleUploadedFile("statement.csv", csv_content, content_type="text/csv")
        
        statement = BankStatement.objects.create(
            user=self.user,
            target_account=self.account,
            file=file,
            original_filename='statement.csv'
        )
        
        service = ImportService(statement)
        service.process()
        
        # Reload statement
        statement.refresh_from_db()
        self.assertEqual(statement.status, BankStatement.STATUS_REVIEW)
        self.assertEqual(statement.transactions.count(), 2)
        
        # Check Deduplication
        dup = statement.transactions.get(amount=Decimal('-50.00'))
        self.assertTrue(dup.is_duplicate)
        self.assertEqual(dup.duplicate_of, self.existing_txn)
        self.assertFalse(dup.selected_for_import)
        
        # Check New
        new_txn = statement.transactions.get(amount=Decimal('-5.00'))
        self.assertFalse(new_txn.is_duplicate)
        self.assertTrue(new_txn.selected_for_import)

    def test_invalid_csv(self):
        csv_content = b"Invalid,Header\n1,2"
        file = SimpleUploadedFile("invalid.csv", csv_content, content_type="text/csv")
        
        statement = BankStatement.objects.create(
            user=self.user,
            file=file,
            original_filename='invalid.csv'
        )
        
        service = ImportService(statement)
        try:
            service.process()
        except:
            pass # Expected to fail
            
        statement.refresh_from_db()
        self.assertEqual(statement.status, BankStatement.STATUS_FAILED)
