from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from .models import HoldingSnapshot, InvestmentAccount, Security, SnapTradeConnection
from .serializers import HoldingSnapshotSerializer, InvestmentAccountSerializer, SnapTradeConnectionSerializer
from .services import _mask_account_number, _stringify_display_name, _stringify_scalar


class InvestmentNormalizationTests(TestCase):
    def test_stringify_scalar_prefers_human_readable_nested_values(self):
        self.assertEqual(_stringify_scalar({"name": "Fidelity"}), "Fidelity")
        self.assertEqual(_stringify_scalar([{"symbol": "VOO"}, {"symbol": "QQQ"}]), "VOO, QQQ")
        self.assertEqual(_stringify_scalar(None, "Fallback"), "Fallback")

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
