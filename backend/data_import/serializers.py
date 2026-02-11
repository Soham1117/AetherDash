from rest_framework import serializers
from .models import BankStatement, ImportedTransaction

class ImportedTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportedTransaction
        fields = '__all__'

class BankStatementSerializer(serializers.ModelSerializer):
    transactions = ImportedTransactionSerializer(many=True, read_only=True)
    
    class Meta:
        model = BankStatement
        fields = ['id', 'original_filename', 'upload_date', 'status', 'error_message', 'processed_at', 'target_account', 'transactions']
        read_only_fields = ['upload_date', 'status', 'error_message', 'processed_at', 'original_filename']
