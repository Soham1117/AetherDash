from rest_framework import serializers

from .models import MarketDailyBar, MarketMetricSnapshot, MarketNewsArticle, TrackedSymbol


class TrackedSymbolSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrackedSymbol
        fields = [
            "id",
            "symbol",
            "name",
            "asset_type",
            "provider",
            "target_weight_percent",
            "active",
            "updated_at",
        ]


class MarketDailyBarSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketDailyBar
        fields = [
            "symbol",
            "date",
            "provider",
            "open",
            "high",
            "low",
            "close",
            "volume",
        ]


class MarketMetricSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketMetricSnapshot
        fields = [
            "symbol",
            "as_of",
            "provider",
            "latest_close",
            "return_1d_percent",
            "return_5d_percent",
            "return_1m_percent",
            "volatility_20d_percent",
            "moving_average_20d",
            "moving_average_50d",
            "rsi_14",
            "updated_at",
        ]


class MarketNewsArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketNewsArticle
        fields = [
            "symbol",
            "provider",
            "title",
            "publisher",
            "url",
            "summary",
            "thumbnail_url",
            "published_at",
            "updated_at",
        ]
