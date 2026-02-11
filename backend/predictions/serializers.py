from rest_framework import serializers
from .models import Prediction


class PredictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prediction
        fields = [
            "id",
            "account",
            "prediction_date",
            "predicted_balance",
            "prediction_type",
            "predicted_transaction_count",
            "is_accurate",
        ]
