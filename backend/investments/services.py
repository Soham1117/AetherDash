import base64
import hashlib
import hmac
import json
from datetime import datetime
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import HoldingSnapshot, InvestmentAccount, OrderSnapshot, Security, SnapTradeConnection


class SnapTradeError(Exception):
    pass


class SnapTradeService:
    def __init__(self):
        self.base_url = getattr(settings, "SNAPTRADE_BASE_URL", "https://api.snaptrade.com/api/v1")
        self.client_id = getattr(settings, "SNAPTRADE_CLIENT_ID", None)
        self.consumer_key = getattr(settings, "SNAPTRADE_CONSUMER_KEY", None)
        if not self.client_id or not self.consumer_key:
            raise SnapTradeError("SnapTrade is not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.")

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "clientId": self.client_id,
            "consumerKey": self.consumer_key,
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json_body: dict[str, Any] | None = None):
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        response = requests.request(method, url, headers=self._headers(), params=params, json=json_body, timeout=45)
        if response.status_code >= 400:
            try:
                payload = response.json()
            except Exception:
                payload = {"detail": response.text}
            raise SnapTradeError(f"SnapTrade request failed ({response.status_code}): {payload}")
        if not response.content:
            return None
        if "application/json" in response.headers.get("content-type", ""):
            return response.json()
        return response.text

    def ensure_user(self, connection: SnapTradeConnection):
        payload = {
            "userId": connection.snaptrade_user_id,
        }
        try:
            return self._request("POST", "/snapTrade/registerUser", json_body=payload)
        except SnapTradeError as exc:
            text = str(exc)
            if "409" in text or "already exists" in text.lower():
                return None
            raise

    def create_login_link(self, connection: SnapTradeConnection, redirect_uri: str | None = None):
        params = {
            "userId": connection.snaptrade_user_id,
            "userSecret": connection.user_secret,
        }
        if redirect_uri:
            params["redirectUri"] = redirect_uri
        return self._request("POST", "/snapTrade/loginLink", json_body=params)

    def list_brokerage_authorizations(self, connection: SnapTradeConnection):
        return self._request(
            "GET",
            "/brokerageAuthorization/list",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def list_accounts(self, connection: SnapTradeConnection, authorization_id: str):
        return self._request(
            "GET",
            f"/brokerageAuthorization/{authorization_id}/accounts",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def refresh_authorization(self, connection: SnapTradeConnection, authorization_id: str):
        return self._request(
            "POST",
            f"/brokerageAuthorization/{authorization_id}/refresh",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        )

    def get_account_holdings(self, connection: SnapTradeConnection, account_id: str):
        return self._request(
            "GET",
            f"/accounts/{account_id}/positions",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def get_account_balances(self, connection: SnapTradeConnection, account_id: str):
        return self._request(
            "GET",
            f"/accounts/{account_id}/balances",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def get_account_orders(self, connection: SnapTradeConnection, account_id: str):
        return self._request(
            "GET",
            f"/accounts/{account_id}/recentOrders",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    @staticmethod
    def verify_webhook_signature(body: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.SNAPTRADE_CONSUMER_KEY.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


def _to_decimal(value: Any, default: str = "0") -> Decimal:
    if value in (None, ""):
        return Decimal(default)
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _pick_first(mapping: dict[str, Any], keys: list[str], default=None):
    for key in keys:
        if key in mapping and mapping[key] not in (None, ""):
            return mapping[key]
    return default


def _stringify_scalar(value: Any, default: str = "") -> str:
    if value in (None, ""):
        return default
    if isinstance(value, str):
        text = value.strip()
        if text.startswith(("{", "[")):
            return default
        return text or default
    if isinstance(value, (int, float, Decimal)):
        return str(value).strip() or default
    if isinstance(value, dict):
        for key in ("symbol", "code", "name", "description", "id", "value"):
            nested = _stringify_scalar(value.get(key), "")
            if nested:
                return nested
        return default
    if isinstance(value, list):
        parts = [_stringify_scalar(item, "") for item in value]
        joined = ", ".join(part for part in parts if part)
        return joined or default
    return default


def _stringify_display_name(value: Any, default: str = "") -> str:
    if value in (None, ""):
        return default
    if isinstance(value, (str, int, float, Decimal)):
        text = str(value).strip()
        if text.startswith(("{", "[")) or "authorization_types" in text:
            return default
        return text or default
    if isinstance(value, dict):
        for key in ("name", "institution_name", "description", "label", "display_name", "value"):
            nested = _stringify_display_name(value.get(key), "")
            if nested:
                return nested
        return default
    if isinstance(value, list):
        parts = [_stringify_display_name(item, "") for item in value]
        joined = ", ".join(part for part in parts if part)
        return joined or default
    return default


def _mask_account_number(value: Any) -> str:
    text = "".join(ch for ch in _stringify_scalar(value, "") if ch.isalnum())
    return text[-4:]


def _parse_ts(value):
    if not value:
        return timezone.now()
    if isinstance(value, datetime):
        dt = value
    else:
        dt = parse_datetime(str(value))
    if dt is None:
        return timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt


def sync_connection_investments(connection: SnapTradeConnection) -> dict[str, Any]:
    service = SnapTradeService()
    service.ensure_user(connection)

    authorizations = service.list_brokerage_authorizations(connection)
    if not authorizations:
        connection.status = SnapTradeConnection.STATUS_PENDING
        connection.save(update_fields=["status", "updated_at"])
        return {"accounts": 0, "holdings": 0, "orders": 0, "connected": False}

    authorization = authorizations[0]
    authorization_id = _stringify_scalar(
        _pick_first(authorization, ["id", "brokerage_authorization_id", "brokerageAuthorizationId"]),
        "",
    )
    connection.brokerage_authorization_id = authorization_id
    connection.brokerage_name = _stringify_display_name(
        _pick_first(authorization, ["brokerage", "brokerage_name", "name", "institution_name"]),
        "Fidelity",
    )
    connection.status = SnapTradeConnection.STATUS_ACTIVE
    connection.metadata = {"authorization": authorization}

    accounts = service.list_accounts(connection, authorization_id)
    now = timezone.now()
    account_count = 0
    holdings_count = 0
    orders_count = 0
    total_value = Decimal("0")

    seen_account_ids = set()

    for raw_account in accounts:
        provider_account_id = str(_pick_first(raw_account, ["id", "account_id", "accountId"]))
        if not provider_account_id or provider_account_id == "None":
            continue
        seen_account_ids.add(provider_account_id)
        account_count += 1

        investment_account, _ = InvestmentAccount.objects.update_or_create(
            provider_account_id=provider_account_id,
            defaults={
                "connection": connection,
                "account_name": _stringify_scalar(
                    _pick_first(raw_account, ["name", "number", "account_name"]),
                    "Investment Account",
                ),
                "brokerage_name": connection.brokerage_name or "Fidelity",
                "account_type": _stringify_scalar(
                    _pick_first(raw_account, ["type", "account_type", "accountType"]),
                    "brokerage",
                ),
                "account_number_mask": _mask_account_number(
                    _pick_first(raw_account, ["number", "account_number", "accountNumber"], ""),
                ),
                "currency": _stringify_scalar(
                    _pick_first(raw_account, ["currency", "currency_code", "currencyCode"]),
                    "USD",
                )[:8] or "USD",
                "is_active": True,
                "raw": raw_account,
                "last_synced_at": now,
            },
        )

        balances = service.get_account_balances(connection, provider_account_id)
        total_equity = Decimal("0")
        cash_balance = Decimal("0")
        buying_power = Decimal("0")
        if isinstance(balances, list):
            for row in balances:
                label = str(_pick_first(row, ["type", "name", "currency"], "")).lower()
                value = _to_decimal(_pick_first(row, ["total", "amount", "value"]))
                if "cash" in label and cash_balance == 0:
                    cash_balance = value
                if "buying" in label and buying_power == 0:
                    buying_power = value
                total_equity += value
        elif isinstance(balances, dict):
            total_equity = _to_decimal(_pick_first(balances, ["total", "totalValue", "equity"]))
            cash_balance = _to_decimal(_pick_first(balances, ["cash", "cashBalance"]))
            buying_power = _to_decimal(_pick_first(balances, ["buyingPower", "buying_power"]))

        holdings = service.get_account_holdings(connection, provider_account_id)
        InvestmentAccount.objects.filter(pk=investment_account.pk).update(
            total_value=total_equity,
            cash_balance=cash_balance,
            buying_power=buying_power,
            last_synced_at=now,
        )
        total_value += total_equity

        current_holdings = set()
        for position in holdings:
            symbol = _stringify_scalar(
                _pick_first(position, ["symbol", "ticker", "security_ticker"]),
                "CASH",
            )[:50] or "CASH"
            security, _ = Security.objects.update_or_create(
                symbol=symbol,
                defaults={
                    "name": _stringify_scalar(
                        _pick_first(position, ["description", "name", "security_name"]),
                        symbol,
                    ),
                    "asset_type": _stringify_scalar(
                        _pick_first(position, ["type", "asset_type", "security_type"]),
                        "equity",
                    ),
                    "currency": _stringify_scalar(
                        _pick_first(position, ["currency", "currencyCode"]),
                        investment_account.currency,
                    )[:8] or investment_account.currency,
                    "exchange": _stringify_scalar(_pick_first(position, ["exchange", "market"]), ""),
                    "raw": position,
                },
            )
            current_holdings.add(security.id)
            quantity = _to_decimal(_pick_first(position, ["quantity", "units", "shares"]))
            avg_price = _to_decimal(_pick_first(position, ["average_purchase_price", "averagePrice", "average_cost"]), "0")
            current_price = _to_decimal(_pick_first(position, ["price", "last_price", "currentPrice"]), "0")
            market_value = _to_decimal(_pick_first(position, ["market_value", "marketValue", "value"]), "0")
            cost_basis = _to_decimal(_pick_first(position, ["cost_basis", "costBasis"]), str(quantity * avg_price))
            weight = Decimal("0") if total_equity == 0 else (market_value / total_equity) * Decimal("100")
            HoldingSnapshot.objects.update_or_create(
                account=investment_account,
                security=security,
                defaults={
                    "quantity": quantity,
                    "average_purchase_price": avg_price,
                    "current_price": current_price,
                    "market_value": market_value,
                    "cost_basis": cost_basis,
                    "weight_percent": weight,
                    "as_of": now,
                    "raw": position,
                },
            )
            holdings_count += 1

        HoldingSnapshot.objects.filter(account=investment_account).exclude(security_id__in=current_holdings).delete()

        orders = service.get_account_orders(connection, provider_account_id)
        current_orders = set()
        for raw_order in orders:
            order_id = str(_pick_first(raw_order, ["id", "order_id", "orderId"]))
            if not order_id:
                continue
            current_orders.add(order_id)
            OrderSnapshot.objects.update_or_create(
                provider_order_id=order_id,
                defaults={
                    "account": investment_account,
                    "symbol": _stringify_scalar(_pick_first(raw_order, ["symbol", "ticker"]), "")[:50],
                    "side": _stringify_scalar(_pick_first(raw_order, ["side", "action"]), "")[:32],
                    "status": _stringify_scalar(_pick_first(raw_order, ["status"]), "")[:64],
                    "order_type": _stringify_scalar(_pick_first(raw_order, ["type", "order_type"]), "")[:64],
                    "quantity": _to_decimal(_pick_first(raw_order, ["quantity", "units"])),
                    "filled_quantity": _to_decimal(_pick_first(raw_order, ["filled_quantity", "filledQuantity"])),
                    "limit_price": _to_decimal(_pick_first(raw_order, ["limit_price", "limitPrice"])),
                    "stop_price": _to_decimal(_pick_first(raw_order, ["stop_price", "stopPrice"])),
                    "average_filled_price": _to_decimal(_pick_first(raw_order, ["average_filled_price", "averageFilledPrice"])),
                    "placed_at": _parse_ts(_pick_first(raw_order, ["time_placed", "placed_at", "createdAt"])),
                    "executed_at": _parse_ts(_pick_first(raw_order, ["time_executed", "executed_at", "executedAt"])),
                    "raw": raw_order,
                },
            )
            orders_count += 1
        OrderSnapshot.objects.filter(account=investment_account).exclude(provider_order_id__in=current_orders).delete()

    InvestmentAccount.objects.filter(connection=connection).exclude(provider_account_id__in=seen_account_ids).update(is_active=False)

    connection.last_synced_at = now
    connection.last_holdings_sync_at = now
    connection.last_orders_sync_at = now
    connection.save(update_fields=[
        "brokerage_authorization_id",
        "brokerage_name",
        "status",
        "metadata",
        "last_synced_at",
        "last_holdings_sync_at",
        "last_orders_sync_at",
        "updated_at",
    ])

    return {
        "accounts": account_count,
        "holdings": holdings_count,
        "orders": orders_count,
        "portfolio_value": str(total_value),
        "connected": True,
    }
