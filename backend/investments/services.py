import base64
import hashlib
import hmac
import json
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode, urlparse

import requests
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import HoldingSnapshot, InvestmentAccount, KrakenLedgerEntry, OrderSnapshot, Security, SnapTradeConnection


class SnapTradeError(Exception):
    pass


class KrakenError(Exception):
    pass


class TastytradeError(Exception):
    pass


KRAKEN_ASSET_ALIASES = {
    "XXBT": "BTC",
    "XBT": "BTC",
    "BTC": "BTC",
    "XETH": "ETH",
    "ETH": "ETH",
    "SOL": "SOL",
}
KRAKEN_USD_ASSETS = {"ZUSD", "USD"}
KRAKEN_CRYPTO_ASSETS = {
    "BTC": {"symbol": "BTC-USD", "name": "Bitcoin", "pair": "XXBTZUSD"},
    "ETH": {"symbol": "ETH-USD", "name": "Ethereum", "pair": "XETHZUSD"},
    "SOL": {"symbol": "SOL-USD", "name": "Solana", "pair": "SOLUSD"},
}


def _kraken_asset_symbol(asset: str) -> str:
    normalized = (asset or "").upper()
    if normalized in KRAKEN_ASSET_ALIASES:
        return KRAKEN_ASSET_ALIASES[normalized]
    if normalized in KRAKEN_USD_ASSETS:
        return "USD"
    return normalized


class SnapTradeService:
    def __init__(self):
        self.base_url = getattr(settings, "SNAPTRADE_BASE_URL", "https://api.snaptrade.com/api/v1")
        self.client_id = getattr(settings, "SNAPTRADE_CLIENT_ID", None)
        self.consumer_key = getattr(settings, "SNAPTRADE_CONSUMER_KEY", None)
        if not self.client_id or not self.consumer_key:
            raise SnapTradeError("SnapTrade is not configured. Set SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY.")

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
        }
        if extra:
            headers.update(extra)
        return headers

    def _signature(self, path: str, query: str, content: dict[str, Any] | None = None) -> str:
        base_path = urlparse(self.base_url).path.rstrip("/")
        signature_path = f"{base_path}/{path.lstrip('/')}"
        signature_payload = {
            "content": content,
            "path": signature_path,
            "query": query,
        }
        canonical_payload = json.dumps(signature_payload, separators=(",", ":"), sort_keys=True)
        digest = hmac.new(
            self.consumer_key.encode("utf-8"),
            canonical_payload.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json_body: dict[str, Any] | None = None):
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        signed_params = {
            **(params or {}),
            "clientId": self.client_id,
            "timestamp": str(int(time.time())),
        }
        query = urlencode(signed_params)
        response = requests.request(
            method,
            url,
            headers=self._headers({"Signature": self._signature(path, query, json_body)}),
            params=signed_params,
            json=json_body,
            timeout=45,
        )
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
            if "409" in text or "1010" in text or "already exist" in text.lower():
                return None
            raise

    def create_login_link(self, connection: SnapTradeConnection, redirect_uri: str | None = None):
        params = {
            "userId": connection.snaptrade_user_id,
            "userSecret": connection.user_secret,
        }
        payload: dict[str, Any] = {}
        if redirect_uri:
            payload["customRedirect"] = redirect_uri
        return self._request("POST", "/snapTrade/login", params=params, json_body=payload or None)

    def list_brokerage_authorizations(self, connection: SnapTradeConnection):
        return self._request(
            "GET",
            "/authorizations",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def list_accounts(self, connection: SnapTradeConnection, authorization_id: str):
        return self._request(
            "GET",
            f"/authorizations/{authorization_id}/accounts",
            params={"userId": connection.snaptrade_user_id, "userSecret": connection.user_secret},
        ) or []

    def refresh_authorization(self, connection: SnapTradeConnection, authorization_id: str):
        return self._request(
            "POST",
            f"/authorizations/{authorization_id}/refresh",
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

    def get_account_orders(self, connection: SnapTradeConnection, account_id: str, days: int = 90):
        return self._request(
            "GET",
            f"/accounts/{account_id}/orders",
            params={
                "userId": connection.snaptrade_user_id,
                "userSecret": connection.user_secret,
                "state": "EXECUTED",
                "days": days,
            },
        ) or []

    @staticmethod
    def verify_webhook_signature(body: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.SNAPTRADE_CONSUMER_KEY.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class KrakenService:
    def __init__(self):
        self.base_url = getattr(settings, "KRAKEN_BASE_URL", "https://api.kraken.com")
        self.api_key = getattr(settings, "KRAKEN_API_KEY", None)
        self.api_secret = getattr(settings, "KRAKEN_API_SECRET", None)
        if not self.api_key or not self.api_secret:
            raise KrakenError("Kraken is not configured. Set KRAKEN_API_KEY and KRAKEN_API_SECRET.")

    def _sign(self, path: str, data: dict[str, Any]) -> str:
        post_data = urlencode(data)
        encoded = (str(data["nonce"]) + post_data).encode("utf-8")
        message = path.encode("utf-8") + hashlib.sha256(encoded).digest()
        digest = hmac.new(base64.b64decode(self.api_secret), message, hashlib.sha512).digest()
        return base64.b64encode(digest).decode("utf-8")

    def _private_request(self, path: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = {"nonce": str(int(time.time() * 1000)), **(data or {})}
        url = f"{self.base_url.rstrip('/')}{path}"
        response = requests.post(
            url,
            headers={
                "API-Key": self.api_key,
                "API-Sign": self._sign(path, payload),
            },
            data=payload,
            timeout=45,
        )
        if response.status_code >= 400:
            raise KrakenError(f"Kraken request failed ({response.status_code}): {response.text}")
        body = response.json()
        errors = body.get("error") or []
        if errors:
            raise KrakenError(f"Kraken request failed: {errors}")
        return body.get("result") or {}

    def _public_request(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        response = requests.get(f"{self.base_url.rstrip('/')}{path}", params=params or {}, timeout=45)
        if response.status_code >= 400:
            raise KrakenError(f"Kraken public request failed ({response.status_code}): {response.text}")
        body = response.json()
        errors = body.get("error") or []
        if errors:
            raise KrakenError(f"Kraken public request failed: {errors}")
        return body.get("result") or {}

    def balances(self) -> dict[str, Any]:
        return self._private_request("/0/private/Balance")

    def ledger(self, limit: int = 200) -> dict[str, Any]:
        return self._private_request("/0/private/Ledgers", {"ofs": 0, "type": "all"}) or {}

    def trades(self) -> dict[str, Any]:
        return self._private_request("/0/private/TradesHistory", {"type": "all"}) or {}

    def usd_prices(self) -> dict[str, Decimal]:
        payload = self._public_request(
            "/0/public/Ticker",
            {"pair": ",".join(asset["pair"] for asset in KRAKEN_CRYPTO_ASSETS.values())},
        )
        prices: dict[str, Decimal] = {}
        for asset, config in KRAKEN_CRYPTO_ASSETS.items():
            ticker = payload.get(config["pair"]) or {}
            if not ticker:
                ticker = next(
                    (
                        value
                        for key, value in payload.items()
                        if asset in key.upper() and "USD" in key.upper()
                    ),
                    {},
                )
            close = ticker.get("c") or []
            prices[asset] = _to_decimal(close[0] if close else None)
        return prices


class TastytradeService:
    def __init__(self):
        self.base_url = getattr(settings, "TASTYTRADE_BASE_URL", "https://api.tastyworks.com").rstrip("/")
        self.user_agent = getattr(settings, "TASTYTRADE_USER_AGENT", "AetherDash/0.1")
        self.client_id = getattr(settings, "TASTYTRADE_CLIENT_ID", "")
        self.client_secret = getattr(settings, "TASTYTRADE_CLIENT_SECRET", "")
        self.refresh_token = getattr(settings, "TASTYTRADE_REFRESH_TOKEN", "")
        self.oauth_scopes = getattr(settings, "TASTYTRADE_OAUTH_SCOPES", "read")
        self.access_token = getattr(settings, "TASTYTRADE_ACCESS_TOKEN", "")
        self.account_number = getattr(settings, "TASTYTRADE_ACCOUNT_NUMBER", "")
        self.live_orders_enabled = bool(getattr(settings, "TASTYTRADE_ENABLE_LIVE_ORDERS", False))
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        })

    def configured(self) -> dict[str, Any]:
        return {
            "configured": bool(self.access_token or (self.client_secret and self.refresh_token)),
            "base_url": self.base_url,
            "has_access_token": bool(self.access_token),
            "has_client_id": bool(self.client_id),
            "has_client_secret": bool(self.client_secret),
            "has_refresh_token": bool(self.refresh_token),
            "has_account_number": bool(self.account_number),
            "oauth_scopes": self.oauth_scopes,
            "live_orders_enabled": self.live_orders_enabled,
        }

    def ensure_access_token(self) -> str:
        if self.access_token:
            return self.access_token
        if not self.client_secret or not self.refresh_token:
            raise TastytradeError("Tastytrade is not configured. Set TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN.")

        response = self.session.post(
            f"{self.base_url}/oauth/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token,
                "client_secret": self.client_secret,
                "scope": self.oauth_scopes,
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": self.user_agent,
            },
            timeout=30,
        )
        if response.status_code >= 400:
            raise TastytradeError(f"Tastytrade OAuth failed ({response.status_code}).")
        payload = response.json()
        token = payload.get("access_token") or payload.get("access-token")
        if not token:
            raise TastytradeError("Tastytrade OAuth response did not include an access token.")
        self.access_token = str(token)
        return self.access_token

    def _request(self, method: str, path: str, **kwargs):
        token = self.ensure_access_token()
        response = self.session.request(
            method,
            f"{self.base_url}/{path.lstrip('/')}",
            headers={"Authorization": f"Bearer {token}", "User-Agent": self.user_agent},
            timeout=kwargs.pop("timeout", 30),
            **kwargs,
        )
        if response.status_code >= 400:
            try:
                payload = response.json()
            except Exception:
                payload = {"detail": response.text}
            raise TastytradeError(f"Tastytrade request failed ({response.status_code}): {payload}")
        if not response.content:
            return None
        if "application/json" in response.headers.get("content-type", ""):
            return response.json()
        return response.text

    def accounts(self):
        return self._request("GET", "/customers/me/accounts")

    def account_items(self) -> list[dict[str, Any]]:
        return _unwrap_tastytrade_items(self.accounts())

    def default_account_number(self) -> str:
        if self.account_number:
            return self.account_number
        accounts = self.account_items()
        if not accounts:
            raise TastytradeError("No Tastytrade accounts returned.")
        account = accounts[0].get("account", accounts[0])
        account_number = account.get("account-number") or account.get("account_number")
        if not account_number:
            raise TastytradeError("Could not find Tastytrade account number.")
        return str(account_number)

    def balances(self, account_number: str | None = None):
        return self._request("GET", f"/accounts/{account_number or self.default_account_number()}/balances")

    def positions(self, account_number: str | None = None):
        return self._request("GET", f"/accounts/{account_number or self.default_account_number()}/positions")

    def live_orders(self, account_number: str | None = None):
        return self._request("GET", f"/accounts/{account_number or self.default_account_number()}/orders/live")

    def option_chain(self, symbol: str = "SPY"):
        return self._request("GET", f"/option-chains/{symbol.upper()}/nested")

    def quote_token(self):
        return self._request("GET", "/api-quote-tokens")

    def order_dry_run(self, order: dict[str, Any], account_number: str | None = None):
        if not isinstance(order, dict) or not isinstance(order.get("legs"), list):
            raise TastytradeError("Order dry-run requires an order object with a legs array.")
        return self._request(
            "POST",
            f"/accounts/{account_number or self.default_account_number()}/orders/dry-run",
            json=order,
        )


def _unwrap_tastytrade_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        data = payload.get("data", payload)
        if isinstance(data, dict):
            items = data.get("items")
            if isinstance(items, list):
                return [item for item in items if isinstance(item, dict)]
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    return []


def summarize_tastytrade_accounts(payload: Any) -> list[dict[str, Any]]:
    rows = []
    for item in _unwrap_tastytrade_items(payload):
        account = item.get("account", item)
        account_number = _stringify_scalar(account.get("account-number") or account.get("account_number"), "")
        rows.append({
            "account_number_mask": _mask_account_number(account_number),
            "account_type_name": _stringify_scalar(account.get("account-type-name") or account.get("account_type_name"), ""),
            "margin_or_cash": _stringify_scalar(account.get("margin-or-cash") or account.get("margin_or_cash"), ""),
            "nickname": _stringify_scalar(account.get("nickname"), "Tastytrade"),
            "suitable_options_level": _stringify_scalar(account.get("suitable-options-level") or account.get("suitable_options_level"), ""),
            "day_trader_status": bool(account.get("day-trader-status") or account.get("day_trader_status")),
            "is_closed": bool(account.get("is-closed") or account.get("is_closed")),
            "authority_level": _stringify_scalar(item.get("authority-level") or item.get("authority_level"), ""),
        })
    return rows


def summarize_tastytrade_balances(payload: Any) -> dict[str, Any]:
    data = payload.get("data", payload) if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        data = {}
    wanted = [
        "net-liquidating-value",
        "cash-balance",
        "pending-cash",
        "equity-buying-power",
        "derivative-buying-power",
        "sma-equity-option-buying-power",
        "maintenance-excess",
        "available-trading-funds",
        "used-derivative-buying-power",
        "snapshot-date",
        "updated-at",
    ]
    return {key.replace("-", "_"): data.get(key) for key in wanted}


def summarize_tastytrade_positions(payload: Any) -> dict[str, Any]:
    items = _unwrap_tastytrade_items(payload)
    return {
        "count": len(items),
        "items": [
            {
                "symbol": _stringify_scalar(item.get("symbol"), ""),
                "instrument_type": _stringify_scalar(item.get("instrument-type") or item.get("instrument_type"), ""),
                "quantity": _stringify_scalar(item.get("quantity"), "0"),
                "quantity_direction": _stringify_scalar(item.get("quantity-direction") or item.get("quantity_direction"), ""),
                "average_open_price": _stringify_scalar(item.get("average-open-price") or item.get("average_open_price"), ""),
                "mark_price": _stringify_scalar(item.get("mark-price") or item.get("mark_price"), ""),
            }
            for item in items[:25]
        ],
    }


def summarize_tastytrade_orders(payload: Any) -> dict[str, Any]:
    items = _unwrap_tastytrade_items(payload)
    return {
        "count": len(items),
        "items": [
            {
                "id": _stringify_scalar(item.get("id"), ""),
                "status": _stringify_scalar(item.get("status"), ""),
                "order_type": _stringify_scalar(item.get("order-type") or item.get("order_type"), ""),
                "price": _stringify_scalar(item.get("price"), ""),
                "price_effect": _stringify_scalar(item.get("price-effect") or item.get("price_effect"), ""),
                "time_in_force": _stringify_scalar(item.get("time-in-force") or item.get("time_in_force"), ""),
                "received_at": _stringify_scalar(item.get("received-at") or item.get("received_at"), ""),
            }
            for item in items[:25]
        ],
    }


def summarize_tastytrade_option_chain(payload: Any, max_expirations: int = 6) -> dict[str, Any]:
    items = _unwrap_tastytrade_items(payload)
    if len(items) == 1 and isinstance(items[0].get("expirations"), list):
        items = [item for item in items[0]["expirations"] if isinstance(item, dict)]
    return {
        "raw_expiration_count": len(items),
        "expirations": [
            {
                "expiration_date": item.get("expiration-date") or item.get("expiration_date"),
                "days_to_expiration": item.get("days-to-expiration") or item.get("days_to_expiration"),
                "strike_count": len(item.get("strikes") or []),
            }
            for item in items[:max_expirations]
        ],
    }


def summarize_tastytrade_quote_token(payload: Any) -> dict[str, Any]:
    data = payload.get("data", payload) if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        data = {}
    return {
        "dxlink_url": data.get("dxlink-url"),
        "issued_at": data.get("issued-at"),
        "expires_at": data.get("expires-at"),
        "level": data.get("level"),
        "has_token": bool(data.get("token")),
    }


def summarize_tastytrade_dry_run(payload: Any) -> dict[str, Any]:
    data = payload.get("data", payload) if isinstance(payload, dict) else {}
    if not isinstance(data, dict):
        data = {}
    order = data.get("order") if isinstance(data.get("order"), dict) else {}
    return {
        "buying_power_effect": data.get("buying-power-effect") or data.get("buying_power_effect"),
        "fee_calculation": data.get("fee-calculation") or data.get("fee_calculation"),
        "warnings": data.get("warnings"),
        "errors": data.get("errors"),
        "order_status": order.get("status"),
        "reject_reason": order.get("reject-reason") or order.get("reject_reason"),
    }


def _to_decimal(value: Any, default: str = "0") -> Decimal:
    if value in (None, ""):
        return Decimal(default)
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _parse_kraken_ts(value):
    if value in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(float(value), tz=UTC)
    except Exception:
        return _parse_ts(value)


def _derive_kraken_buy_costs_from_ledger(ledger_entries: dict[str, Any]) -> tuple[dict[str, Decimal], dict[str, Decimal]]:
    grouped: dict[str, dict[str, Any]] = {}
    for entry in ledger_entries.values():
        if not isinstance(entry, dict):
            continue
        ref_id = str(entry.get("refid") or "")
        if not ref_id:
            continue

        asset = _kraken_asset_symbol(str(entry.get("asset") or ""))
        amount = _to_decimal(entry.get("amount"))
        fee = abs(_to_decimal(entry.get("fee")))
        entry_type = str(entry.get("type") or "").lower()
        group = grouped.setdefault(ref_id, {"crypto": {}, "usd_spend": Decimal("0")})

        if asset in KRAKEN_CRYPTO_ASSETS and amount > 0 and entry_type in {"receive", "trade"}:
            group["crypto"][asset] = group["crypto"].get(asset, Decimal("0")) + amount
        elif asset == "USD" and amount < 0 and entry_type in {"spend", "trade"}:
            group["usd_spend"] += abs(amount) + fee

    buy_costs = {asset: Decimal("0") for asset in KRAKEN_CRYPTO_ASSETS}
    buy_quantities = {asset: Decimal("0") for asset in KRAKEN_CRYPTO_ASSETS}
    for group in grouped.values():
        crypto = group["crypto"]
        usd_spend = group["usd_spend"]
        if usd_spend <= 0 or len(crypto) != 1:
            continue
        asset, quantity = next(iter(crypto.items()))
        if quantity <= 0:
            continue
        buy_costs[asset] += usd_spend
        buy_quantities[asset] += quantity

    return buy_costs, buy_quantities


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
        dt = timezone.make_aware(dt, UTC)
    return dt


def _order_symbol(raw_order: dict[str, Any]) -> str:
    universal_symbol = raw_order.get("universal_symbol")
    if isinstance(universal_symbol, dict):
        symbol = _stringify_scalar(
            _pick_first(universal_symbol, ["symbol", "raw_symbol", "ticker", "description"]),
            "",
        )
        if symbol:
            return symbol

    option_symbol = raw_order.get("option_symbol")
    if isinstance(option_symbol, dict):
        symbol = _stringify_scalar(
            _pick_first(option_symbol, ["ticker", "symbol"]),
            "",
        )
        if symbol:
            return symbol

    return _stringify_scalar(_pick_first(raw_order, ["ticker", "symbol"]), "")


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
        holdings_market_value = Decimal("0")
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
            if market_value == 0 and quantity and current_price:
                market_value = quantity * current_price
            holdings_market_value += market_value
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

        if total_equity == 0 and holdings_market_value > 0:
            total_equity = holdings_market_value
            total_value += holdings_market_value
            InvestmentAccount.objects.filter(pk=investment_account.pk).update(total_value=total_equity)
            for holding in HoldingSnapshot.objects.filter(account=investment_account, security_id__in=current_holdings):
                holding.weight_percent = (holding.market_value / total_equity) * Decimal("100")
                holding.save(update_fields=["weight_percent", "updated_at"])

        HoldingSnapshot.objects.filter(account=investment_account).exclude(security_id__in=current_holdings).delete()

        orders = service.get_account_orders(connection, provider_account_id)
        current_orders = set()
        for raw_order in orders:
            status = _stringify_scalar(_pick_first(raw_order, ["status"]), "")[:64]
            if status.upper() != "EXECUTED":
                continue

            order_id = _stringify_scalar(_pick_first(raw_order, ["brokerage_order_id", "id", "order_id", "orderId"]), "")
            if not order_id:
                continue
            current_orders.add(order_id)
            OrderSnapshot.objects.update_or_create(
                provider_order_id=order_id,
                defaults={
                    "account": investment_account,
                    "symbol": _order_symbol(raw_order)[:50],
                    "side": _stringify_scalar(_pick_first(raw_order, ["action", "side"]), "")[:32],
                    "status": status,
                    "order_type": _stringify_scalar(_pick_first(raw_order, ["order_type", "type"]), "")[:64],
                    "quantity": _to_decimal(_pick_first(raw_order, ["total_quantity", "quantity", "units"])),
                    "filled_quantity": _to_decimal(_pick_first(raw_order, ["filled_quantity", "filledQuantity"])),
                    "limit_price": _to_decimal(_pick_first(raw_order, ["limit_price", "limitPrice"])),
                    "stop_price": _to_decimal(_pick_first(raw_order, ["stop_price", "stopPrice"])),
                    "average_filled_price": _to_decimal(_pick_first(raw_order, ["execution_price", "average_filled_price", "averageFilledPrice"])),
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


def sync_kraken_investments(user: User) -> dict[str, Any]:
    service = KrakenService()
    now = timezone.now()

    balances = service.balances()
    trades_payload = service.trades()
    ledger_payload = service.ledger()
    prices = service.usd_prices()

    crypto_quantities = {asset: Decimal("0") for asset in KRAKEN_CRYPTO_ASSETS}
    usd_cash = Decimal("0")
    normalized_balances: dict[str, str] = {}
    for asset, raw_balance in balances.items():
        symbol = _kraken_asset_symbol(asset)
        amount = _to_decimal(raw_balance)
        normalized_balances[symbol] = str(amount)
        if symbol in crypto_quantities:
            crypto_quantities[symbol] += amount
        elif symbol == "USD":
            usd_cash += amount

    trades = trades_payload.get("trades") if isinstance(trades_payload, dict) else {}
    if not isinstance(trades, dict):
        trades = {}

    ledger_entries = ledger_payload.get("ledger") if isinstance(ledger_payload, dict) else {}
    if not isinstance(ledger_entries, dict):
        ledger_entries = {}

    buy_costs = {asset: Decimal("0") for asset in KRAKEN_CRYPTO_ASSETS}
    buy_quantities = {asset: Decimal("0") for asset in KRAKEN_CRYPTO_ASSETS}
    for trade in trades.values():
        if not isinstance(trade, dict):
            continue
        pair = str(trade.get("pair") or "").upper()
        trade_type = str(trade.get("type") or "").lower()
        asset = next((candidate for candidate in KRAKEN_CRYPTO_ASSETS if candidate in pair or (candidate == "BTC" and "XBT" in pair)), "")
        if not asset:
            continue
        if trade_type != "buy":
            continue
        volume = _to_decimal(trade.get("vol"))
        cost = _to_decimal(trade.get("cost"))
        fee = _to_decimal(trade.get("fee"))
        buy_quantities[asset] += volume
        buy_costs[asset] += cost + fee

    ledger_buy_costs, ledger_buy_quantities = _derive_kraken_buy_costs_from_ledger(ledger_entries)
    for asset in KRAKEN_CRYPTO_ASSETS:
        if buy_quantities[asset] <= 0 and ledger_buy_quantities[asset] > 0:
            buy_quantities[asset] = ledger_buy_quantities[asset]
            buy_costs[asset] = ledger_buy_costs[asset]

    market_values = {
        asset: crypto_quantities[asset] * prices.get(asset, Decimal("0"))
        for asset in KRAKEN_CRYPTO_ASSETS
    }
    total_value = sum(market_values.values(), usd_cash)

    connection, _ = SnapTradeConnection.objects.get_or_create(
        user=user,
        snaptrade_user_id=f"kraken-{user.id}",
        defaults={
            "user_secret": "",
            "brokerage_name": "Kraken",
            "status": SnapTradeConnection.STATUS_ACTIVE,
        },
    )
    connection.brokerage_name = "Kraken"
    connection.status = SnapTradeConnection.STATUS_ACTIVE
    connection.disabled_reason = ""
    connection.metadata = {"provider": "kraken", "balances": normalized_balances}
    connection.last_synced_at = now
    connection.last_holdings_sync_at = now
    connection.last_orders_sync_at = now
    connection.save(update_fields=[
        "brokerage_name",
        "status",
        "disabled_reason",
        "metadata",
        "last_synced_at",
        "last_holdings_sync_at",
        "last_orders_sync_at",
        "updated_at",
    ])

    account, _ = InvestmentAccount.objects.update_or_create(
        provider_account_id=f"kraken-spot-{user.id}",
        defaults={
            "connection": connection,
            "account_name": "Kraken Spot",
            "brokerage_name": "Kraken",
            "account_type": "crypto",
            "account_number_mask": "spot",
            "currency": "USD",
            "total_value": total_value,
            "cash_balance": usd_cash,
            "buying_power": usd_cash,
            "is_active": True,
            "last_synced_at": now,
            "raw": {"balances": normalized_balances},
        },
    )

    active_security_ids = set()
    for asset, config in KRAKEN_CRYPTO_ASSETS.items():
        quantity = crypto_quantities[asset]
        buy_quantity = buy_quantities[asset]
        buy_cost = buy_costs[asset]
        avg_cost = (buy_cost / buy_quantity) if buy_quantity > 0 else Decimal("0")
        market_value = market_values[asset]
        security, _ = Security.objects.update_or_create(
            symbol=config["symbol"],
            defaults={
                "name": config["name"],
                "asset_type": "crypto",
                "currency": "USD",
                "exchange": "Kraken",
                "raw": {"kraken_pair": config["pair"]},
            },
        )
        active_security_ids.add(security.id)
        HoldingSnapshot.objects.update_or_create(
            account=account,
            security=security,
            defaults={
                "quantity": quantity,
                "average_purchase_price": avg_cost,
                "current_price": prices.get(asset, Decimal("0")),
                "market_value": market_value,
                "cost_basis": min(buy_cost, quantity * avg_cost) if quantity > 0 else Decimal("0"),
                "weight_percent": (market_value / total_value * Decimal("100")) if total_value > 0 else Decimal("0"),
                "as_of": now,
                "raw": {
                    "balances": normalized_balances,
                    "buy_quantity": str(buy_quantity),
                    "buy_cost": str(buy_cost),
                },
            },
        )
    HoldingSnapshot.objects.filter(account=account).exclude(security_id__in=active_security_ids).delete()

    current_order_ids = set()
    for trade_id, trade in trades.items():
        if not isinstance(trade, dict):
            continue
        pair = str(trade.get("pair") or "").upper()
        asset = next((candidate for candidate in KRAKEN_CRYPTO_ASSETS if candidate in pair or (candidate == "BTC" and "XBT" in pair)), "")
        if not asset:
            continue
        provider_order_id = str(trade.get("ordertxid") or trade_id)
        current_order_ids.add(provider_order_id)
        OrderSnapshot.objects.update_or_create(
            provider_order_id=provider_order_id,
            defaults={
                "account": account,
                "symbol": KRAKEN_CRYPTO_ASSETS[asset]["symbol"],
                "side": str(trade.get("type") or "").upper(),
                "status": "EXECUTED",
                "order_type": str(trade.get("ordertype") or "")[:64],
                "quantity": _to_decimal(trade.get("vol")),
                "filled_quantity": _to_decimal(trade.get("vol")),
                "limit_price": _to_decimal(trade.get("price")),
                "stop_price": Decimal("0"),
                "average_filled_price": _to_decimal(trade.get("price")),
                "placed_at": _parse_kraken_ts(trade.get("time")),
                "executed_at": _parse_kraken_ts(trade.get("time")),
                "raw": trade,
            },
        )
    OrderSnapshot.objects.filter(account=account).exclude(provider_order_id__in=current_order_ids).delete()

    for ledger_id, entry in ledger_entries.items():
        if not isinstance(entry, dict):
            continue
        KrakenLedgerEntry.objects.update_or_create(
            ledger_id=str(ledger_id),
            defaults={
                "user": user,
                "ref_id": str(entry.get("refid") or ""),
                "entry_type": str(entry.get("type") or "")[:64],
                "subtype": str(entry.get("subtype") or "")[:64],
                "asset": _kraken_asset_symbol(str(entry.get("asset") or ""))[:32],
                "amount": _to_decimal(entry.get("amount")),
                "fee": _to_decimal(entry.get("fee")),
                "balance": _to_decimal(entry.get("balance")),
                "timestamp": _parse_kraken_ts(entry.get("time")),
                "raw": entry,
            },
        )

    holdings_count = sum(1 for quantity in crypto_quantities.values() if quantity > 0)

    return {
        "accounts": 1,
        "holdings": holdings_count,
        "orders": len(current_order_ids),
        "ledger_entries": len(ledger_entries),
        "quantities": {asset: str(quantity) for asset, quantity in crypto_quantities.items()},
        "prices": {asset: str(price) for asset, price in prices.items()},
        "btc_quantity": str(crypto_quantities.get("BTC", Decimal("0"))),
        "btc_price": str(prices.get("BTC", Decimal("0"))),
        "portfolio_value": str(total_value),
        "connected": True,
    }
