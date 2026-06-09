from __future__ import annotations

import math
import json
import statistics
import subprocess
import textwrap
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Iterable

from django.conf import settings
from django.utils.dateparse import parse_date, parse_datetime

from .models import MarketDailyBar, MarketMetricSnapshot, TrackedSymbol


DEFAULT_TRACKED_SYMBOLS = {
    "QQQM": Decimal("30.0000"),
    "SCHD": Decimal("25.0000"),
    "VXUS": Decimal("20.0000"),
    "VB": Decimal("25.0000"),
}


class MarketDataError(Exception):
    pass


@dataclass(frozen=True)
class DailyBar:
    symbol: str
    date: date
    open: Decimal | None = None
    high: Decimal | None = None
    low: Decimal | None = None
    close: Decimal | None = None
    volume: int | None = None
    raw: dict[str, Any] | None = None


def _to_decimal(value: Any) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, float) and math.isnan(value):
            return None
        return Decimal(str(value))
    except Exception:
        return None


def _to_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        if isinstance(value, float) and math.isnan(value):
            return None
        return int(value)
    except Exception:
        return None


def _to_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    parsed_date = parse_date(str(value)) if value else None
    if parsed_date:
        return parsed_date
    parsed_datetime = parse_datetime(str(value)) if value else None
    return parsed_datetime.date() if parsed_datetime else None


def _row_value(row: Any, *keys: str):
    if isinstance(row, dict):
        for key in keys:
            if key in row:
                return row[key]
        return None
    for key in keys:
        if hasattr(row, key):
            return getattr(row, key)
    return None


def _rows_from_openbb_result(result: Any) -> list[Any]:
    if result is None:
        return []
    if hasattr(result, "to_df"):
        frame = result.to_df()
        return frame.reset_index().to_dict("records")
    if hasattr(result, "results"):
        return list(result.results or [])
    if isinstance(result, dict):
        if isinstance(result.get("results"), list):
            return result["results"]
        return [result]
    if isinstance(result, Iterable) and not isinstance(result, (str, bytes)):
        return list(result)
    return []


class OpenBBMarketDataClient:
    def __init__(self, provider: str = "yfinance"):
        self.provider = provider

    def fetch_daily_history(self, symbol: str, *, start_date: str | None = None) -> list[DailyBar]:
        try:
            from openbb import obb
        except ImportError as exc:
            worker_python = getattr(settings, "OPENBB_PYTHON_BIN", "")
            if worker_python:
                return self._fetch_daily_history_with_worker(worker_python, symbol, start_date=start_date)
            raise MarketDataError("OpenBB is not installed in this backend environment.") from exc

        kwargs: dict[str, Any] = {"symbol": symbol, "provider": self.provider}
        if start_date:
            kwargs["start_date"] = start_date
        result = obb.equity.price.historical(**kwargs)
        return normalize_daily_bars(symbol, result)

    def _fetch_daily_history_with_worker(self, worker_python: str, symbol: str, *, start_date: str | None = None) -> list[DailyBar]:
        script = textwrap.dedent(
            """
            import json
            import sys

            from openbb import obb

            symbol = sys.argv[1]
            provider = sys.argv[2]
            start_date = sys.argv[3] or None
            kwargs = {"symbol": symbol, "provider": provider}
            if start_date:
                kwargs["start_date"] = start_date
            result = obb.equity.price.historical(**kwargs)
            frame = result.to_df().reset_index()
            rows = []
            for row in frame.to_dict("records"):
                cleaned = {}
                for key, value in row.items():
                    if hasattr(value, "isoformat"):
                        cleaned[key] = value.isoformat()
                    elif value != value:
                        cleaned[key] = None
                    else:
                        cleaned[key] = value
                rows.append(cleaned)
            print("__OPENBB_JSON__" + json.dumps(rows))
            """
        ).strip()
        try:
            process = subprocess.run(
                [worker_python, "-c", script, symbol, self.provider, start_date or ""],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )
        except OSError as exc:
            raise MarketDataError(f"Unable to execute OpenBB worker Python: {worker_python}") from exc
        except subprocess.TimeoutExpired as exc:
            raise MarketDataError(f"OpenBB worker timed out while fetching {symbol}.") from exc

        if process.returncode != 0:
            detail = process.stderr.strip() or process.stdout.strip()
            raise MarketDataError(f"OpenBB worker failed for {symbol}: {detail}")

        payload_line = next(
            (line for line in reversed(process.stdout.splitlines()) if line.startswith("__OPENBB_JSON__")),
            "",
        )
        if not payload_line:
            raise MarketDataError(f"OpenBB worker did not return JSON for {symbol}.")
        return normalize_daily_bars(symbol, json.loads(payload_line.removeprefix("__OPENBB_JSON__")))


def normalize_daily_bars(symbol: str, result: Any) -> list[DailyBar]:
    bars: list[DailyBar] = []
    for row in _rows_from_openbb_result(result):
        row_date = _to_date(_row_value(row, "date", "datetime", "timestamp"))
        if not row_date:
            continue
        bars.append(
            DailyBar(
                symbol=symbol.upper(),
                date=row_date,
                open=_to_decimal(_row_value(row, "open")),
                high=_to_decimal(_row_value(row, "high")),
                low=_to_decimal(_row_value(row, "low")),
                close=_to_decimal(_row_value(row, "close", "adj_close", "adjusted_close")),
                volume=_to_int(_row_value(row, "volume")),
                raw=dict(row) if isinstance(row, dict) else {},
            )
        )
    return sorted(bars, key=lambda bar: bar.date)


def seed_default_symbols() -> list[TrackedSymbol]:
    tracked = []
    for symbol, weight in DEFAULT_TRACKED_SYMBOLS.items():
        obj, _ = TrackedSymbol.objects.update_or_create(
            symbol=symbol,
            defaults={
                "asset_type": "etf",
                "provider": "yfinance",
                "target_weight_percent": weight,
                "active": True,
            },
        )
        tracked.append(obj)
    return tracked


def _percent_change(latest: Decimal | None, prior: Decimal | None) -> Decimal | None:
    if latest in (None, Decimal("0")) or prior in (None, Decimal("0")):
        return None
    return ((latest - prior) / prior) * Decimal("100")


def _average(values: list[Decimal]) -> Decimal | None:
    return sum(values) / Decimal(len(values)) if values else None


def _rsi(closes: list[Decimal], periods: int = 14) -> Decimal | None:
    if len(closes) <= periods:
        return None
    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = changes[-periods:]
    gains = [change for change in recent if change > 0]
    losses = [-change for change in recent if change < 0]
    avg_gain = _average(gains) or Decimal("0")
    avg_loss = _average(losses) or Decimal("0")
    if avg_loss == 0:
        return Decimal("100") if avg_gain > 0 else None
    rs = avg_gain / avg_loss
    return Decimal("100") - (Decimal("100") / (Decimal("1") + rs))


def compute_metric_snapshot(symbol: str, bars: list[MarketDailyBar], provider: str = "yfinance") -> MarketMetricSnapshot | None:
    ordered = sorted([bar for bar in bars if bar.close is not None], key=lambda bar: bar.date)
    if not ordered:
        return None
    closes = [bar.close for bar in ordered if bar.close is not None]
    latest = ordered[-1]
    daily_returns = [
        float((closes[i] - closes[i - 1]) / closes[i - 1])
        for i in range(1, len(closes))
        if closes[i - 1] not in (None, Decimal("0"))
    ]
    volatility = None
    if len(daily_returns) >= 20:
        volatility = Decimal(str(statistics.stdev(daily_returns[-20:]) * math.sqrt(252) * 100))

    snapshot, _ = MarketMetricSnapshot.objects.update_or_create(
        symbol=symbol.upper(),
        as_of=latest.date,
        provider=provider,
        defaults={
            "latest_close": latest.close,
            "return_1d_percent": _percent_change(closes[-1], closes[-2] if len(closes) >= 2 else None),
            "return_5d_percent": _percent_change(closes[-1], closes[-6] if len(closes) >= 6 else None),
            "return_1m_percent": _percent_change(closes[-1], closes[-22] if len(closes) >= 22 else None),
            "volatility_20d_percent": volatility,
            "moving_average_20d": _average(closes[-20:]) if len(closes) >= 20 else None,
            "moving_average_50d": _average(closes[-50:]) if len(closes) >= 50 else None,
            "rsi_14": _rsi(closes),
            "raw": {"bar_count": len(ordered)},
        },
    )
    return snapshot


def refresh_market_data(symbols: list[str] | None = None, provider: str = "yfinance", client: OpenBBMarketDataClient | None = None) -> dict[str, Any]:
    if not symbols:
        seed_default_symbols()
        symbols = list(DEFAULT_TRACKED_SYMBOLS.keys())
    normalized_symbols = [symbol.strip().upper() for symbol in symbols if symbol.strip()]
    market_client = client or OpenBBMarketDataClient(provider=provider)

    refreshed: dict[str, Any] = {"symbols": {}, "errors": {}}
    for symbol in normalized_symbols:
        try:
            bars = market_client.fetch_daily_history(symbol)
            for bar in bars:
                MarketDailyBar.objects.update_or_create(
                    symbol=symbol,
                    date=bar.date,
                    provider=provider,
                    defaults={
                        "open": bar.open,
                        "high": bar.high,
                        "low": bar.low,
                        "close": bar.close,
                        "volume": bar.volume,
                        "raw": bar.raw or {},
                    },
                )
            stored_bars = list(MarketDailyBar.objects.filter(symbol=symbol, provider=provider).order_by("date"))
            snapshot = compute_metric_snapshot(symbol, stored_bars, provider=provider)
            refreshed["symbols"][symbol] = {
                "bars": len(bars),
                "as_of": snapshot.as_of.isoformat() if snapshot else None,
            }
        except Exception as exc:
            refreshed["errors"][symbol] = str(exc)
    return refreshed
