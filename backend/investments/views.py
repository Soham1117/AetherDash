import json
import uuid

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated

from .models import InvestmentAccount, SnapTradeConnection
from .serializers import InvestmentAccountSerializer, SnapTradeConnectionSerializer
from .services import SnapTradeError, SnapTradeService, sync_connection_investments


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def begin_snaptrade_connect(request):
    try:
        connection, _ = SnapTradeConnection.objects.get_or_create(
            user=request.user,
            defaults={
                "snaptrade_user_id": f"aetherdash-{request.user.id}",
                "user_secret": uuid.uuid4().hex,
            },
        )
        if not connection.snaptrade_user_id:
            connection.snaptrade_user_id = f"aetherdash-{request.user.id}"
        if not connection.user_secret:
            connection.user_secret = uuid.uuid4().hex
        connection.save(update_fields=["snaptrade_user_id", "user_secret", "updated_at"])

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
    try:
        connection = SnapTradeConnection.objects.get(user=request.user)
    except SnapTradeConnection.DoesNotExist:
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
    connection = SnapTradeConnection.objects.filter(user=request.user).first()
    accounts = InvestmentAccount.objects.filter(connection=connection, is_active=True) if connection else InvestmentAccount.objects.none()
    return JsonResponse({
        "connected": bool(connection and connection.status == SnapTradeConnection.STATUS_ACTIVE),
        "connection": SnapTradeConnectionSerializer(connection).data if connection else None,
        "accounts": InvestmentAccountSerializer(accounts, many=True).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refresh_snaptrade_data(request):
    connection = SnapTradeConnection.objects.filter(user=request.user).first()
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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def portfolio_summary(request):
    connection = SnapTradeConnection.objects.filter(user=request.user).first()
    accounts = InvestmentAccount.objects.filter(connection=connection, is_active=True).prefetch_related("holdings__security", "orders") if connection else InvestmentAccount.objects.none()

    serialized_accounts = InvestmentAccountSerializer(accounts, many=True).data
    total_value = sum(float(account.total_value) for account in accounts)
    total_cash = sum(float(account.cash_balance) for account in accounts)
    total_buying_power = sum(float(account.buying_power) for account in accounts)
    latest_sync = max((account.last_synced_at for account in accounts if account.last_synced_at), default=(connection.last_synced_at if connection else None))

    return JsonResponse({
        "connected": bool(connection and connection.status == SnapTradeConnection.STATUS_ACTIVE),
        "connection": SnapTradeConnectionSerializer(connection).data if connection else None,
        "accounts": serialized_accounts,
        "totals": {
            "portfolio_value": total_value,
            "cash_balance": total_cash,
            "buying_power": total_buying_power,
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
