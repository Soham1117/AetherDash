from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.test import TestCase
from django.utils import timezone

from .models import HoldingSnapshot, InvestmentAccount, OrderSnapshot, Security, SnapTradeConnection
from .serializers import HoldingSnapshotSerializer, InvestmentAccountSerializer, OrderSnapshotSerializer, SnapTradeConnectionSerializer
from .services import SnapTradeError, SnapTradeService, _mask_account_number, _stringify_display_name, _stringify_scalar, sync_connection_investments
from .views import _cash_equivalent_value, _is_cash_equivalent_holding


class InvestmentNormalizationTests(TestCase):
    def test_stringify_scalar_prefers_human_readable_nested_values(self):
        self.assertEqual(_stringify_scalar({"name": "Fidelity"}), "Fidelity")
        self.assertEqual(_stringify_scalar([{"symbol": "VOO"}, {"symbol": "QQQ"}]), "VOO, QQQ")
        self.assertEqual(_stringify_scalar(None, "Fallback"), "Fallback")
        self.assertEqual(_stringify_scalar("{'symbol': {'symbol': 'SPAXX'}}", "CASH"), "CASH")

    def test_display_name_ignores_authorization_payloads(self):
        authorization_payload = {
            "authorization_types": [{"type": "read", "auth_type": "OAUTH"}],
            "brokerage": {"id": "fidelity-id"},
        }

        self.assertEqual(_stringify_display_name(authorization_payload, "Fidelity"), "Fidelity")
        self.assertEqual(_stringify_display_name({"brokerage": {"id": "fidelity-id"}}, "Fidelity"), "Fidelity")
        self.assertEqual(_stringify_display_name({"name": "Fidelity"}, "Fallback"), "Fidelity")

    def test_mask_account_number_keeps_last_four_alnum_characters(self):
        self.assertEqual(_mask_account_number("AB-1234-5678"), "5678")
        self.assertEqual(_mask_account_number({"id": "00009999"}), "9999")

    def test_serializers_fall_back_to_raw_readable_fields(self):
        user = User.objects.create_user(username="investor", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user",
            user_secret="secret",
            brokerage_name="",
        )
        account = InvestmentAccount.objects.create(
            connection=connection,
            provider_account_id="acct-1",
            account_name="",
            brokerage_name="",
            account_type="",
            account_number_mask="",
            currency="",
            raw={
                "name": "Roth IRA",
                "number": "12345678",
                "type": "retirement",
                "currency": "usd",
            },
        )
        security = Security.objects.create(symbol="VOO", name="", raw={"description": "Vanguard S&P 500 ETF"})
        holding = HoldingSnapshot.objects.create(
            account=account,
            security=security,
            raw={"description": "Vanguard S&P 500 ETF"},
            as_of=timezone.now(),
        )

        account_data = InvestmentAccountSerializer(account).data
        holding_data = HoldingSnapshotSerializer(holding).data

        self.assertEqual(account_data["account_name"], "Roth IRA")
        self.assertEqual(account_data["account_number_mask"], "5678")
        self.assertEqual(account_data["account_type"], "retirement")
        self.assertEqual(account_data["currency"], "usd")
        self.assertEqual(holding_data["name"], "Vanguard S&P 500 ETF")
        self.assertEqual(holding_data["symbol"], "VOO")

    def test_connection_serializer_hides_raw_authorization_text(self):
        user = User.objects.create_user(username="brokerage-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-2",
            user_secret="secret",
            brokerage_name=str({
                "authorization_types": [{"type": "read", "auth_type": "OAUTH"}],
                "brokerage": {"id": "fidelity-id"},
            }),
        )

        data = SnapTradeConnectionSerializer(connection).data

        self.assertEqual(data["brokerage_name"], "Fidelity")

    def test_holding_serializer_hides_raw_security_text(self):
        user = User.objects.create_user(username="holding-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-4",
            user_secret="secret",
            brokerage_name="Fidelity",
        )
        account = InvestmentAccount.objects.create(
            connection=connection,
            provider_account_id="acct-holding",
            account_name="Individual",
            brokerage_name="Fidelity",
        )
        raw_symbol = {
            "symbol": {
                "symbol": "SPAXX",
                "description": "Fidelity Government Money Market Fund",
                "currency": {"code": "USD", "name": "US Dollar"},
            }
        }
        security = Security.objects.create(
            symbol="{bad}",
            name="{bad}",
            currency="{bad}",
            raw={"symbol": raw_symbol, "currency": {"code": "USD", "name": "US Dollar"}},
        )
        holding = HoldingSnapshot.objects.create(
            account=account,
            security=security,
            raw={"symbol": raw_symbol, "currency": {"code": "USD", "name": "US Dollar"}},
            as_of=timezone.now(),
        )

        data = HoldingSnapshotSerializer(holding).data

        self.assertEqual(data["symbol"], "SPAXX")
        self.assertEqual(data["name"], "SPAXX")
        self.assertEqual(data["security"]["symbol"], "SPAXX")
        self.assertEqual(data["security"]["currency"], "USD")

    def test_spaxx_counts_as_cash_equivalent_value(self):
        user = User.objects.create_user(username="cash-equivalent-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-cash-equivalent",
            user_secret="secret",
            brokerage_name="Fidelity",
        )
        account = InvestmentAccount.objects.create(
            connection=connection,
            provider_account_id="acct-cash-equivalent",
            account_name="Individual",
            brokerage_name="Fidelity",
        )
        security = Security.objects.create(
            symbol="SPAXX",
            name="Fidelity Government Money Market Fund",
            asset_type="mutual_fund",
        )
        holding = HoldingSnapshot.objects.create(
            account=account,
            security=security,
            market_value="810.00",
            as_of=timezone.now(),
        )

        self.assertTrue(_is_cash_equivalent_holding(holding))
        self.assertEqual(_cash_equivalent_value([account]), Decimal("810.00"))

    def test_account_serializer_hides_raw_authorization_text(self):
        user = User.objects.create_user(username="account-brokerage-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-3",
            user_secret="secret",
            brokerage_name="Fidelity",
        )
        account = InvestmentAccount.objects.create(
            connection=connection,
            provider_account_id="acct-raw-brokerage",
            account_name="Brokerage Account",
            brokerage_name=str({
                "authorization_types": [{"type": "read", "auth_type": "OAUTH"}],
                "brokerage": {"id": "fidelity-id"},
            }),
        )

        data = InvestmentAccountSerializer(account).data

        self.assertEqual(data["brokerage_name"], "Fidelity")

    @override_settings(SNAPTRADE_CLIENT_ID="client", SNAPTRADE_CONSUMER_KEY="consumer")
    def test_snaptrade_completed_orders_request_uses_full_orders_endpoint(self):
        user = User.objects.create_user(username="orders-request-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-orders",
            user_secret="snap-secret",
            brokerage_name="Fidelity",
        )
        service = SnapTradeService()

        with patch.object(service, "_request", return_value=[]) as request:
            service.get_account_orders(connection, "account-123")

        request.assert_called_once_with(
            "GET",
            "/accounts/account-123/orders",
            params={
                "userId": "snap-user-orders",
                "userSecret": "snap-secret",
                "state": "EXECUTED",
                "days": 90,
            },
        )

    @override_settings(SNAPTRADE_CLIENT_ID="client", SNAPTRADE_CONSUMER_KEY="consumer")
    def test_snaptrade_connection_methods_use_current_authorizations_endpoints(self):
        user = User.objects.create_user(username="connection-request-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-connections",
            user_secret="snap-secret",
            brokerage_name="Fidelity",
        )
        service = SnapTradeService()

        with patch.object(service, "_request", return_value=[]) as request:
            service.list_brokerage_authorizations(connection)
            service.list_accounts(connection, "auth-123")
            service.refresh_authorization(connection, "auth-123")
            service.create_login_link(connection, "https://aetherdash.xyz/investments?snaptrade=return")

        self.assertEqual(request.mock_calls[0].args[1], "/authorizations")
        self.assertEqual(request.mock_calls[1].args[1], "/authorizations/auth-123/accounts")
        self.assertEqual(request.mock_calls[2].args[1], "/authorizations/auth-123/refresh")
        self.assertEqual(request.mock_calls[3].args[1], "/snapTrade/login")
        self.assertEqual(
            request.mock_calls[3].kwargs["json_body"],
            {"customRedirect": "https://aetherdash.xyz/investments?snaptrade=return"},
        )

    @override_settings(SNAPTRADE_CLIENT_ID="client", SNAPTRADE_CONSUMER_KEY="consumer")
    def test_snaptrade_requests_are_signed_with_query_auth(self):
        class Response:
            status_code = 200
            content = b"[]"
            headers = {"content-type": "application/json"}
            text = "[]"

            def json(self):
                return []

        service = SnapTradeService()

        with patch("investments.services.time.time", return_value=1780000000):
            with patch("investments.services.requests.request", return_value=Response()) as request:
                service._request("GET", "/accounts/account-123/orders", params={"userId": "user", "userSecret": "secret"})

        _, _, kwargs = request.mock_calls[0]
        self.assertEqual(kwargs["params"]["clientId"], "client")
        self.assertEqual(kwargs["params"]["timestamp"], "1780000000")
        self.assertIn("Signature", kwargs["headers"])
        self.assertNotIn("consumerKey", kwargs["headers"])

    @override_settings(SNAPTRADE_CLIENT_ID="client", SNAPTRADE_CONSUMER_KEY="consumer")
    def test_snaptrade_register_treats_existing_user_as_success(self):
        user = User.objects.create_user(username="existing-snaptrade-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-existing",
            user_secret="snap-secret",
            brokerage_name="Fidelity",
        )
        service = SnapTradeService()

        with patch.object(
            service,
            "_request",
            side_effect=SnapTradeError("SnapTrade request failed (400): {'code': '1010', 'detail': 'User with the following userId already exist'}"),
        ):
            self.assertIsNone(service.ensure_user(connection))

    def test_sync_stores_only_completed_orders_from_snaptrade(self):
        class FakeSnapTradeService:
            def ensure_user(self, connection):
                return None

            def list_brokerage_authorizations(self, connection):
                return [{"id": "auth-1", "brokerage": {"name": "Fidelity"}}]

            def list_accounts(self, connection, authorization_id):
                return [{"id": "account-1", "name": "Individual", "type": "brokerage", "currency": "USD"}]

            def get_account_balances(self, connection, account_id):
                return {"total": "1000.00", "cash": "100.00", "buyingPower": "100.00"}

            def get_account_holdings(self, connection, account_id):
                return []

            def get_account_orders(self, connection, account_id):
                return [
                    {
                        "brokerage_order_id": "completed-1",
                        "status": "EXECUTED",
                        "universal_symbol": {"symbol": "VOO", "description": "Vanguard S&P 500 ETF"},
                        "action": "BUY",
                        "order_type": "Market",
                        "total_quantity": "2",
                        "filled_quantity": "2",
                        "execution_price": "500.25",
                        "time_placed": "2026-06-08T15:01:00Z",
                        "time_executed": "2026-06-08T15:02:00Z",
                    },
                    {
                        "brokerage_order_id": "canceled-1",
                        "status": "CANCELED",
                        "universal_symbol": {"symbol": "QQQ"},
                        "action": "SELL",
                    },
                ]

        user = User.objects.create_user(username="orders-sync-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-sync-orders",
            user_secret="snap-secret",
            brokerage_name="",
        )

        with patch("investments.services.SnapTradeService", FakeSnapTradeService):
            result = sync_connection_investments(connection)

        self.assertEqual(result["orders"], 1)
        self.assertEqual(OrderSnapshot.objects.count(), 1)

        order = OrderSnapshot.objects.get()
        self.assertEqual(order.provider_order_id, "completed-1")
        self.assertEqual(order.symbol, "VOO")
        self.assertEqual(order.side, "BUY")
        self.assertEqual(order.status, "EXECUTED")
        self.assertEqual(str(order.quantity), "2.00000000")
        self.assertEqual(str(order.average_filled_price), "500.2500")

        data = OrderSnapshotSerializer(order).data
        self.assertEqual(data["symbol"], "VOO")
        self.assertEqual(data["side"], "BUY")
