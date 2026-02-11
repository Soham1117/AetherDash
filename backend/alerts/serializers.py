from rest_framework import serializers
from .models import Alert, Notification


class AlertSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.account_name', read_only=True)
    
    class Meta:
        model = Alert
        fields = "__all__"
        read_only_fields = ['user', 'last_triggered_at', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    alert_rule = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True, source='alert_rule.id')
    
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = ['user', 'created_at']
