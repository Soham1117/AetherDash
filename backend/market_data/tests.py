from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase

from django.utils import timezone

from .models import MarketDailyBar, MarketMetricSnapshot, MarketNewsArticle, TrackedSymbol
from .services import DailyBar, NewsArticle, normalize_daily_bars, refresh_market_data, seed_default_symbols


class FakeMarketDataClient:
    def fetch_daily_history(self, symbol):
        start = date(2026, 1, 1)
        return [
            DailyBar(
                symbol=symbol,
                date=start + timedelta(days=i),
                open=Decimal("100") + i,
                high=Decimal("101") + i,
                low=Decimal("99") + i,
                close=Decimal("100") + i,
                volume=1000 + i,
            )
            for i in range(60)
        ]

    def fetch_news(self, symbol):
        return [
            NewsArticle(
                symbol=symbol,
                title=f"{symbol} ETF update",
                url=f"https://example.com/{symbol.lower()}",
                publisher="Example Markets",
                summary="Market update.",
                published_at=timezone.now(),
            )
        ]


class MarketDataTests(TestCase):
    def test_seed_default_symbols_creates_four_plan_etfs(self):
        seed_default_symbols()

        symbols = list(TrackedSymbol.objects.order_by("symbol").values_list("symbol", "target_weight_percent"))

        self.assertEqual(
            symbols,
            [
                ("QQQM", Decimal("30.0000")),
                ("SCHD", Decimal("25.0000")),
                ("VB", Decimal("25.0000")),
                ("VXUS", Decimal("20.0000")),
            ],
        )

    def test_normalize_daily_bars_accepts_provider_rows(self):
        bars = normalize_daily_bars(
            "QQQM",
            [
                {
                    "date": "2026-06-08",
                    "open": 295.53,
                    "high": 296.00,
                    "low": 294.00,
                    "close": 294.81,
                    "volume": 123456,
                }
            ],
        )

        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0].symbol, "QQQM")
        self.assertEqual(bars[0].date.isoformat(), "2026-06-08")
        self.assertEqual(bars[0].close, Decimal("294.81"))

    def test_refresh_market_data_stores_bars_and_metrics(self):
        result = refresh_market_data(symbols=["QQQM"], client=FakeMarketDataClient())

        self.assertEqual(result["symbols"]["QQQM"]["bars"], 60)
        self.assertEqual(MarketDailyBar.objects.filter(symbol="QQQM").count(), 60)

        metric = MarketMetricSnapshot.objects.get(symbol="QQQM")
        self.assertEqual(metric.latest_close, Decimal("159.000000"))
        self.assertIsNotNone(metric.return_1d_percent)
        self.assertIsNotNone(metric.moving_average_20d)
        self.assertIsNotNone(metric.rsi_14)
        self.assertEqual(MarketNewsArticle.objects.filter(symbol="QQQM").count(), 1)
