from rest_framework import serializers

from .models import HoldingSnapshot, InvestmentAccount, OrderSnapshot, Security, SnapTradeConnection
from .services import _order_symbol, _stringify_display_name, _stringify_scalar


class SnapTradeConnectionSerializer(serializers.ModelSerializer):
    brokerage_name = serializers.SerializerMethodField()

    def get_brokerage_name(self, obj):
        return _stringify_display_name(obj.brokerage_name, "Fidelity")

    class Meta:
        model = SnapTradeConnection
        fields = [
            "id",
            "brokerage_name",
            "status",
            "last_synced_at",
            "last_holdings_sync_at",
            "last_orders_sync_at",
            "disabled_reason",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


def _currency_code(value, default="USD"):
    if isinstance(value, dict) and value.get("code"):
        return _stringify_scalar(value.get("code"), default)
    return _stringify_scalar(value, default)


class SecuritySerializer(serializers.ModelSerializer):
    symbol = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()
    asset_type = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    exchange = serializers.SerializerMethodField()

    def get_symbol(self, obj):
        return (
            _stringify_scalar(obj.symbol, "")
            or _stringify_scalar(obj.raw.get("symbol"), "")
            or _stringify_scalar(obj.raw.get("ticker"), "")
            or _stringify_scalar(obj.raw.get("raw_symbol"), "")
            or "CASH"
        )

    def get_name(self, obj):
        return (
            _stringify_scalar(obj.name, "")
            or _stringify_scalar(obj.raw.get("description"), "")
            or _stringify_scalar(obj.raw.get("name"), "")
            or _stringify_scalar(obj.raw.get("security_name"), "")
            or self.get_symbol(obj)
        )

    def get_asset_type(self, obj):
        return _stringify_scalar(obj.asset_type or obj.raw.get("type") or obj.raw.get("security_type"), "equity")

    def get_currency(self, obj):
        return _currency_code(obj.currency or obj.raw.get("currency") or obj.raw.get("currencyCode"), "USD")

    def get_exchange(self, obj):
        return _stringify_scalar(obj.exchange or obj.raw.get("exchange") or obj.raw.get("market"), "")

    class Meta:
        model = Security
        fields = ["symbol", "name", "asset_type", "currency", "exchange"]


class HoldingSnapshotSerializer(serializers.ModelSerializer):
    security = SecuritySerializer(read_only=True)
    symbol = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    def get_symbol(self, obj):
        return (
            _stringify_scalar(obj.security.symbol, "")
            or _stringify_scalar(obj.raw.get("symbol"), "")
            or _stringify_scalar(obj.raw.get("ticker"), "")
            or "CASH"
        )

    def get_name(self, obj):
        return (
            _stringify_scalar(obj.security.name, "")
            or _stringify_scalar(obj.raw.get("description"), "")
            or _stringify_scalar(obj.raw.get("name"), "")
            or _stringify_scalar(obj.raw.get("security_name"), "")
            or self.get_symbol(obj)
        )

    class Meta:
        model = HoldingSnapshot
        fields = [
            "id",
            "security",
            "symbol",
            "name",
            "quantity",
            "average_purchase_price",
            "current_price",
            "market_value",
            "cost_basis",
            "weight_percent",
            "as_of",
        ]


class OrderSnapshotSerializer(serializers.ModelSerializer):
    symbol = serializers.SerializerMethodField()
    side = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    order_type = serializers.SerializerMethodField()

    def get_symbol(self, obj):
        return obj.symbol or _order_symbol(obj.raw) or ""

    def get_side(self, obj):
        return obj.side or _stringify_scalar(obj.raw.get("action") or obj.raw.get("side"), "")

    def get_status(self, obj):
        return obj.status or _stringify_scalar(obj.raw.get("status"), "")

    def get_order_type(self, obj):
        return obj.order_type or _stringify_scalar(obj.raw.get("order_type") or obj.raw.get("type"), "")

    class Meta:
        model = OrderSnapshot
        fields = [
            "id",
            "provider_order_id",
            "symbol",
            "side",
            "status",
            "order_type",
            "quantity",
            "filled_quantity",
            "limit_price",
            "stop_price",
            "average_filled_price",
            "placed_at",
            "executed_at",
        ]


class InvestmentAccountSerializer(serializers.ModelSerializer):
    holdings = HoldingSnapshotSerializer(many=True, read_only=True)
    orders = OrderSnapshotSerializer(many=True, read_only=True)
    account_name = serializers.SerializerMethodField()
    brokerage_name = serializers.SerializerMethodField()
    account_type = serializers.SerializerMethodField()
    account_number_mask = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()

    def get_account_name(self, obj):
        return _stringify_scalar(
            obj.account_name or obj.raw.get("name") or obj.raw.get("account_name"),
            "Investment Account",
        )

    def get_brokerage_name(self, obj):
        return _stringify_display_name(
            obj.brokerage_name or obj.raw.get("brokerage_name"),
            "Fidelity",
        )

    def get_account_type(self, obj):
        return _stringify_scalar(
            obj.account_type or obj.raw.get("type") or obj.raw.get("account_type"),
            "Brokerage",
        )

    def get_account_number_mask(self, obj):
        if obj.account_number_mask:
            return obj.account_number_mask
        account_number = obj.raw.get("number") or obj.raw.get("account_number") or obj.raw.get("accountNumber") or ""
        return str(account_number)[-4:]

    def get_currency(self, obj):
        return _stringify_scalar(obj.currency or obj.raw.get("currency") or obj.raw.get("currencyCode"), "USD")

    class Meta:
        model = InvestmentAccount
        fields = [
            "id",
            "provider_account_id",
            "account_name",
            "brokerage_name",
            "account_type",
            "account_number_mask",
            "currency",
            "total_value",
            "cash_balance",
            "buying_power",
            "is_active",
            "last_synced_at",
            "holdings",
            "orders",
        ]


class PortfolioSummarySerializer(serializers.Serializer):
    connection = SnapTradeConnectionSerializer(allow_null=True)
    connected = serializers.BooleanField()
    accounts = InvestmentAccountSerializer(many=True)
    totals = serializers.DictField()
    as_of = serializers.DateTimeField(allow_null=True)
