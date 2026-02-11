from rest_framework import serializers
from .models import Budget


from categories.serializers import CategorySerializer

class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category_group.name', read_only=True)
    
    class Meta:
        model = Budget
        fields = ['id', 'user', 'category_group', 'category_name', 'amount', 'start_date', 'end_date']
        read_only_fields = ['user']
