import json
import uuid
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import InvestmentAccount, KrakenLedgerEntry, SnapTradeConnection
from .serializers import InvestmentAccountSerializer, KrakenLedgerEntrySerializer, SnapTradeConnectionSerializer
from .services import KrakenError, SnapTradeError, SnapTradeService, _stringify_scalar, sync_connection_investments, sync_kraken_investments


CASH_EQUIVALENT_SYMBOLS = {"SPAXX", "FDRXX", "FZFXX", "FDLXX", "SPRXX", "FCASH", "CASH"}
CENT = Decimal("0.01")


def _snaptrade_connections(user):
    return SnapTradeConnection.objects.filter(user=user).exclude(snaptrade_user_id__startswith="kraken-")


def _kraken_connection(user):
    return SnapTradeConnection.objects.filter(user=user, snaptrade_user_id=f"kraken-{user.id}").first()


def _holding_symbol(holding):
    return (
        _stringify_scalar(holding.security.symbol, "")
        or _stringify_scalar(holding.raw.get("symbol"), "")
        or _stringify_scalar(holding.raw.get("ticker"), "")
    ).upper()


def _is_cash_equivalent_holding(holding):
    symbol = _holding_symbol(holding)
    if symbol in CASH_EQUIVALENT_SYMBOLS:
        return True

    asset_type = _stringify_scalar(holding.security.asset_type or holding.raw.get("type") or holding.raw.get("security_type"), "").lower()
    name = (
        _stringify_scalar(holding.security.name, "")
        or _stringify_scalar(holding.raw.get("description"), "")
        or _stringify_scalar(holding.raw.get("name"), "")
        or _stringify_scalar(holding.raw.get("security_name"), "")
    ).lower()
    return "money market" in asset_type or "money market" in name


def _cash_equivalent_value(accounts):
    total = Decimal("0")
    for account in accounts:
        for holding in account.holdings.all():
            if _is_cash_equivalent_holding(holding):
                total += _to_decimal(holding.market_value)
    return total


def _to_decimal(value):
    if value in (None, ""):
        return Decimal("0")
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _recent_cash_equivalent_commitments(accounts, lookback_days=7):
    cutoff = timezone.now() - timedelta(days=lookback_days)
    total = Decimal("0")
    for account in accounts:
        if _to_decimal(account.cash_balance) or _to_decimal(account.buying_power):
            continue

        cash_equivalent_value = Decimal("0")
        for holding in account.holdings.all():
            if _is_cash_equivalent_holding(holding):
                cash_equivalent_value += _to_decimal(holding.market_value)
        if cash_equivalent_value <= 0:
            continue

        for order in account.orders.all():
            symbol = _stringify_scalar(order.symbol, "").upper()
            if symbol in CASH_EQUIVALENT_SYMBOLS:
                continue
            if order.status.upper() != "EXECUTED" or order.side.upper() != "BUY":
                continue
            order_time = order.executed_at or order.placed_at
            if not order_time or order_time < cutoff:
                continue

            quantity = _to_decimal(order.filled_quantity or order.quantity)
            total += quantity * _to_decimal(order.average_filled_price)
    return total


def _portfolio_totals(accounts):
    total_cash = sum((_to_decimal(account.cash_balance) for account in accounts), Decimal("0"))
    total_buying_power = sum((_to_decimal(account.buying_power) for account in accounts), Decimal("0"))
    raw_cash_equivalents = _cash_equivalent_value(accounts)
    recent_commitments = min(raw_cash_equivalents, _recent_cash_equivalent_commitments(accounts))
    cash_equivalents = max(raw_cash_equivalents - recent_commitments, Decimal("0"))
    total_value = sum((_to_decimal(account.total_value) for account in accounts), Decimal("0")) - recent_commitments
    available_to_invest = max(total_buying_power, total_cash + cash_equivalents)

    return {
        "portfolio_value": float(total_value.quantize(CENT)),
        "cash_balance": float(total_cash.quantize(CENT)),
        "buying_power": float(total_buying_power.quantize(CENT)),
        "cash_equivalents": float(cash_equivalents.quantize(CENT)),
        "available_to_invest": float(available_to_invest.quantize(CENT)),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def begin_snaptrade_connect(request):
    try:
        connection = _snaptrade_connections(request.user).first()
        if not connection:
            connection = SnapTradeConnection.objects.create(
                user=request.user,
                snaptrade_user_id=f"aetherdash-{request.user.id}",
                user_secret=uuid.uuid4().hex,
            )
        else:
            if not connection.snaptrade_user_id:
                connection.snaptrade_user_id = f"aetherdash-{request.user.id}"
            if not connection.user_secret:
                connection.user_secret = uuid.uuid4().hex
            connection.save(update_fields=["snaptrade_user_id", "user_secret", "updated_at"])
        SnapTradeConnection.objects.filter(
            user=request.user,
            snaptrade_user_id=f"aetherdash-{request.user.id}",
        ).exclude(pk=connection.pk).delete()

        service = SnapTradeService()
        service.ensure_user(connection)
        redirect_uri = request.data.get("redirect_uri") or getattr(settings, "SNAPTRADE_REDIRECT_URI", "")
        payload = service.create_login_link(connection, redirect_uri=redirect_uri or None)
        return JsonResponse({
            "status": "ok",
            "connection": SnapTradeConnectionSerializer(connection).data,
            "login_link": payload,
        })
    except SnapTradeError as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def complete_snaptrade_connect(request):
    connection = _snaptrade_connections(request.user).first()
    if not connection:
        return JsonResponse({"error": "SnapTrade connection not initialized."}, status=404)

    try:
        sync_result = sync_connection_investments(connection)
        return JsonResponse({
            "status": "ok",
            "sync": sync_result,
            "connection": SnapTradeConnectionSerializer(connection).data,
        })
    except SnapTradeError as exc:
        connection.status = SnapTradeConnection.STATUS_BROKEN
        connection.disabled_reason = str(exc)
        connection.save(update_fields=["status", "disabled_reason", "updated_at"])
        return JsonResponse({"error": str(exc)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def snaptrade_status(request):
    connection = _snaptrade_connections(request.user).first()
    accounts = InvestmentAccount.objects.filter(connection=connection, is_active=True) if connection else InvestmentAccount.objects.none()
    return JsonResponse({
        "connected": bool(connection and connection.status == SnapTradeConnection.STATUS_ACTIVE),
        "connection": SnapTradeConnectionSerializer(connection).data if connection else None,
        "accounts": InvestmentAccountSerializer(accounts, many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refresh_snaptrade_data(request):
    connection = _snaptrade_connections(request.user).first()
    if not connection:
        return JsonResponse({"error": "SnapTrade connection not found."}, status=404)

    try:
        sync_result = sync_connection_investments(connection)
        return JsonResponse({
            "status": "ok",
            "sync": sync_result,
            "connection": SnapTradeConnectionSerializer(connection).data,
        })
    except SnapTradeError as exc:
        connection.status = SnapTradeConnection.STATUS_BROKEN
        connection.disabled_reason = str(exc)
        connection.save(update_fields=["status", "disabled_reason", "updated_at"])
        return JsonResponse({"error": str(exc)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refresh_kraken_data(request):
    try:
        sync_result = sync_kraken_investments(request.user)
        return JsonResponse({"status": "ok", "sync": sync_result})
    except KrakenError as exc:
        return JsonResponse({"error": str(exc)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kraken_ledger(request):
    limit = min(int(request.query_params.get("limit", "100")), 500)
    entries = KrakenLedgerEntry.objects.filter(user=request.user).order_by("-timestamp", "-created_at")[:limit]
    return JsonResponse({"ledger": KrakenLedgerEntrySerializer(entries, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def portfolio_summary(request):
    connections = SnapTradeConnection.objects.filter(user=request.user)
    snaptrade_connection = _snaptrade_connections(request.user).first()
    kraken_connection = _kraken_connection(request.user)
    accounts = InvestmentAccount.objects.filter(connection__in=connections, is_active=True).prefetch_related("holdings__security", "orders")

    serialized_accounts = InvestmentAccountSerializer(accounts, many=True).data
    totals = _portfolio_totals(accounts)
    latest_sync = max((account.last_synced_at for account in accounts if account.last_synced_at), default=None)

    return JsonResponse({
        "connected": bool(snaptrade_connection and snaptrade_connection.status == SnapTradeConnection.STATUS_ACTIVE),
        "crypto_connected": bool(kraken_connection and kraken_connection.status == SnapTradeConnection.STATUS_ACTIVE),
        "connection": SnapTradeConnectionSerializer(snaptrade_connection).data if snaptrade_connection else None,
        "crypto_connection": SnapTradeConnectionSerializer(kraken_connection).data if kraken_connection else None,
        "accounts": serialized_accounts,
        "totals": {
            **totals,
            "account_count": len(serialized_accounts),
        },
        "as_of": latest_sync.isoformat() if latest_sync else None,
    })


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def snaptrade_webhook(request):
    signature = request.headers.get("Signature") or request.headers.get("signature")
    if not signature:
        return JsonResponse({"error": "Missing Signature header."}, status=400)

    if not getattr(settings, "SNAPTRADE_CONSUMER_KEY", None):
        return JsonResponse({"error": "SnapTrade not configured."}, status=500)

    if not SnapTradeService.verify_webhook_signature(request.body, signature):
        return JsonResponse({"error": "Invalid signature."}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    user_id = payload.get("userId")
    event_type = payload.get("eventType") or payload.get("type")
    connection = SnapTradeConnection.objects.filter(snaptrade_user_id=user_id).first()
    if connection:
        metadata = connection.metadata or {}
        metadata.setdefault("webhooks", []).append(payload)
        metadata["webhooks"] = metadata["webhooks"][-20:]
        if event_type == "CONNECTION_BROKEN":
            connection.status = SnapTradeConnection.STATUS_BROKEN
            connection.disabled_reason = payload.get("detail", "Connection broken")
        elif event_type in {"CONNECTION_FIXED", "CONNECTION_ADDED"}:
            connection.status = SnapTradeConnection.STATUS_ACTIVE
            connection.disabled_reason = ""
        connection.metadata = metadata
        connection.save(update_fields=["status", "disabled_reason", "metadata", "updated_at"])
    return JsonResponse({"received": True})
