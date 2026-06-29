from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import override_settings
from django.test import TestCase
from django.utils import timezone

from .models import HoldingSnapshot, InvestmentAccount, KrakenLedgerEntry, OrderSnapshot, Security, SnapTradeConnection
from .serializers import HoldingSnapshotSerializer, InvestmentAccountSerializer, OrderSnapshotSerializer, SnapTradeConnectionSerializer
from .services import (
    SnapTradeError,
    SnapTradeService,
    TastytradeService,
    _derive_kraken_buy_costs_from_ledger,
    _mask_account_number,
    _stringify_display_name,
    _stringify_scalar,
    summarize_tastytrade_accounts,
    summarize_tastytrade_dry_run,
    summarize_tastytrade_option_chain,
    summarize_tastytrade_quote_token,
    sync_connection_investments,
    sync_kraken_investments,
)
from .views import _cash_equivalent_value, _is_cash_equivalent_holding, _portfolio_totals


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

    def test_kraken_ledger_buy_costs_pair_receive_with_usd_spend(self):
        ledger_entries = {
            "receive-1": {
                "refid": "trade-1",
                "type": "receive",
                "asset": "XXBT",
                "amount": "0.00241308",
                "fee": "0",
            },
            "spend-1": {
                "refid": "trade-1",
                "type": "spend",
                "asset": "ZUSD",
                "amount": "-147.78",
                "fee": "2.22",
            },
            "receive-2": {
                "refid": "trade-2",
                "type": "receive",
                "asset": "XXBT",
                "amount": "0.00158436",
                "fee": "0",
            },
            "spend-2": {
                "refid": "trade-2",
                "type": "spend",
                "asset": "ZUSD",
                "amount": "-102.97",
                "fee": "1.03",
            },
        }

        costs, quantities = _derive_kraken_buy_costs_from_ledger(ledger_entries)

        self.assertEqual(costs["BTC"], Decimal("254.00"))
        self.assertEqual(quantities["BTC"], Decimal("0.00399744"))
        self.assertEqual(costs["ETH"], Decimal("0"))
        self.assertEqual(quantities["SOL"], Decimal("0"))

    @override_settings(
        TASTYTRADE_BASE_URL="https://api.tastyworks.com",
        TASTYTRADE_CLIENT_ID="client-id",
        TASTYTRADE_CLIENT_SECRET="client-secret",
        TASTYTRADE_REFRESH_TOKEN="refresh-token",
        TASTYTRADE_OAUTH_SCOPES="read trade openid",
        TASTYTRADE_ENABLE_LIVE_ORDERS=False,
    )
    def test_tastytrade_config_reports_presence_without_secret_values(self):
        config = TastytradeService().configured()

        self.assertTrue(config["configured"])
        self.assertTrue(config["has_client_id"])
        self.assertTrue(config["has_client_secret"])
        self.assertTrue(config["has_refresh_token"])
        self.assertEqual(config["oauth_scopes"], "read trade openid")
        self.assertFalse(config["live_orders_enabled"])
        self.assertNotIn("client-secret", str(config))
        self.assertNotIn("refresh-token", str(config))

    def test_tastytrade_summaries_mask_sensitive_payloads(self):
        accounts = summarize_tastytrade_accounts({
            "data": {
                "items": [
                    {
                        "authority-level": "owner",
                        "account": {
                            "account-number": "5WI90087",
                            "account-type-name": "Individual",
                            "margin-or-cash": "Margin",
                            "nickname": "Individual",
                            "suitable-options-level": "Covered And Cash Secured",
                        },
                    }
                ]
            }
        })
        quote = summarize_tastytrade_quote_token({
            "data": {
                "dxlink-url": "wss://example",
                "issued-at": "2026-06-29T20:55:56Z",
                "expires-at": "2026-06-30T20:55:56Z",
                "level": "api",
                "token": "secret-market-token",
            }
        })
        chain = summarize_tastytrade_option_chain({
            "data": {
                "items": [
                    {
                        "expirations": [
                            {"expiration-date": "2026-06-30", "days-to-expiration": 1, "strikes": [{}, {}]},
                            {"expiration-date": "2026-07-01", "days-to-expiration": 2, "strikes": [{}]},
                        ]
                    }
                ]
            }
        })
        dry_run = summarize_tastytrade_dry_run({
            "data": {
                "buying-power-effect": {"impact": "101.12"},
                "warnings": [{"code": "tif.next_valid_session"}],
                "order": {"status": "Received", "reject-reason": None},
            }
        })

        self.assertEqual(accounts[0]["account_number_mask"], "0087")
        self.assertEqual(accounts[0]["suitable_options_level"], "Covered And Cash Secured")
        self.assertTrue(quote["has_token"])
        self.assertNotIn("secret-market-token", str(quote))
        self.assertEqual(chain["raw_expiration_count"], 2)
        self.assertEqual(chain["expirations"][0]["strike_count"], 2)
        self.assertEqual(dry_run["buying_power_effect"]["impact"], "101.12")
        self.assertEqual(dry_run["order_status"], "Received")

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

    def test_recent_non_cash_buy_reduces_stale_spaxx_available_cash(self):
        user = User.objects.create_user(username="stale-spaxx-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-stale-spaxx",
            user_secret="secret",
            brokerage_name="Fidelity",
        )
        account = InvestmentAccount.objects.create(
            connection=connection,
            provider_account_id="acct-stale-spaxx",
            account_name="Individual",
            brokerage_name="Fidelity",
            total_value="885.84",
            cash_balance="0.00",
            buying_power="0.00",
        )
        spaxx = Security.objects.create(
            symbol="SPAXX",
            name="Fidelity Government Money Market Fund",
            asset_type="mutual_fund",
        )
        qqqm = Security.objects.create(symbol="QQQM", name="Invesco NASDAQ 100 ETF")
        HoldingSnapshot.objects.create(
            account=account,
            security=spaxx,
            market_value="810.90",
            as_of=timezone.now(),
        )
        HoldingSnapshot.objects.create(
            account=account,
            security=qqqm,
            market_value="74.94",
            as_of=timezone.now(),
        )
        OrderSnapshot.objects.create(
            account=account,
            provider_order_id="qqqm-buy-1",
            symbol="QQQM",
            side="BUY",
            status="EXECUTED",
            filled_quantity="0.254",
            average_filled_price="294.19",
            executed_at=timezone.now(),
        )

        totals = _portfolio_totals([account])

        self.assertEqual(totals["cash_equivalents"], 736.18)
        self.assertEqual(totals["available_to_invest"], 736.18)
        self.assertEqual(totals["portfolio_value"], 811.12)

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

    def test_sync_derives_holding_value_from_units_and_price(self):
        class FakeSnapTradeService:
            def ensure_user(self, connection):
                return None

            def list_brokerage_authorizations(self, connection):
                return [{"id": "auth-1", "brokerage": {"name": "Fidelity"}}]

            def list_accounts(self, connection, authorization_id):
                return [{"id": "account-spaxx", "name": "Individual", "type": "brokerage", "currency": "USD"}]

            def get_account_balances(self, connection, account_id):
                return {"total": "0.00", "cash": "0.00", "buyingPower": "0.00"}

            def get_account_holdings(self, connection, account_id):
                return [
                    {
                        "symbol": "SPAXX",
                        "description": "Fidelity Government Money Market Fund",
                        "units": "810.9",
                        "price": "1.00",
                        "average_purchase_price": "1.00",
                    }
                ]

            def get_account_orders(self, connection, account_id):
                return []

        user = User.objects.create_user(username="spaxx-sync-user", password="secret")
        connection = SnapTradeConnection.objects.create(
            user=user,
            snaptrade_user_id="snap-user-spaxx",
            user_secret="snap-secret",
            brokerage_name="",
        )

        with patch("investments.services.SnapTradeService", FakeSnapTradeService):
            sync_connection_investments(connection)

        account = InvestmentAccount.objects.get(provider_account_id="account-spaxx")
        holding = HoldingSnapshot.objects.get(account=account)

        self.assertEqual(holding.symbol if hasattr(holding, "symbol") else holding.security.symbol, "SPAXX")
        self.assertEqual(holding.market_value, Decimal("810.90"))
        self.assertEqual(account.total_value, Decimal("810.90"))

    def test_kraken_sync_returns_multi_asset_summary(self):
        class FakeKrakenService:
            def balances(self):
                return {
                    "XXBT": "0.1",
                    "XETH": "1.5",
                    "SOL": "10",
                    "ZUSD": "25.00",
                }

            def trades(self):
                return {
                    "trades": {
                        "trade-btc": {
                            "ordertxid": "order-btc",
                            "pair": "XXBTZUSD",
                            "type": "buy",
                            "ordertype": "market",
                            "vol": "0.1",
                            "cost": "6000",
                            "fee": "10",
                            "price": "60000",
                            "time": "1780000000",
                        },
                        "trade-eth": {
                            "ordertxid": "order-eth",
                            "pair": "XETHZUSD",
                            "type": "buy",
                            "ordertype": "market",
                            "vol": "1.5",
                            "cost": "4500",
                            "fee": "5",
                            "price": "3000",
                            "time": "1780000001",
                        },
                        "trade-sol": {
                            "ordertxid": "order-sol",
                            "pair": "SOLUSD",
                            "type": "buy",
                            "ordertype": "market",
                            "vol": "10",
                            "cost": "1500",
                            "fee": "2",
                            "price": "150",
                            "time": "1780000002",
                        },
                    }
                }

            def ledger(self):
                return {
                    "ledger": {
                        "ledger-1": {
                            "refid": "ref-1",
                            "type": "trade",
                            "subtype": "",
                            "asset": "XXBT",
                            "amount": "0.1",
                            "fee": "0",
                            "balance": "0.1",
                            "time": "1780000000",
                        }
                    }
                }

            def usd_prices(self):
                return {
                    "BTC": Decimal("61000"),
                    "ETH": Decimal("3100"),
                    "SOL": Decimal("160"),
                }

        user = User.objects.create_user(username="kraken-sync-user", password="secret")

        with patch("investments.services.KrakenService", FakeKrakenService):
            result = sync_kraken_investments(user)

        self.assertEqual(result["holdings"], 3)
        self.assertEqual(result["orders"], 3)
        self.assertEqual(result["ledger_entries"], 1)
        self.assertEqual(result["quantities"], {"BTC": "0.1", "ETH": "1.5", "SOL": "10"})
        self.assertEqual(result["prices"], {"BTC": "61000", "ETH": "3100", "SOL": "160"})
        self.assertEqual(result["btc_quantity"], "0.1")
        self.assertEqual(result["btc_price"], "61000")
        self.assertEqual(result["portfolio_value"], "12375.00")

        account = InvestmentAccount.objects.get(provider_account_id=f"kraken-spot-{user.id}")
        self.assertEqual(account.total_value, Decimal("12375.00"))
        self.assertEqual(HoldingSnapshot.objects.filter(account=account).count(), 3)
        self.assertEqual(OrderSnapshot.objects.filter(account=account).count(), 3)
        self.assertEqual(KrakenLedgerEntry.objects.filter(user=user).count(), 1)
