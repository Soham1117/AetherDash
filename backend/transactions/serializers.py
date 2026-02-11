from rest_framework import serializers
from .models import Transaction, TransactionLineItem, Tag, CategorizationRule, RecurringTransaction, SavingsGoal

class SavingsGoalSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()
    
    class Meta:
        model = SavingsGoal
        fields = '__all__'
        read_only_fields = ['user', 'is_completed']
    
    def get_progress(self, obj):
        return obj.progress_percentage()

class RecurringTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category_ref.name', read_only=True)
    class Meta:
        model = RecurringTransaction
        fields = '__all__'
        read_only_fields = ['user']

class CategorizationRuleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category_ref.name', read_only=True)
    class Meta:
        model = CategorizationRule
        fields = '__all__'
        read_only_fields = ['user']

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = '__all__'

class TransactionLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionLineItem
        fields = "__all__"

class TransactionSerializer(serializers.ModelSerializer):
    line_items = TransactionLineItemSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), source='tags', write_only=True, required=False)

    class Meta:
        model = Transaction
        fields = "__all__"
