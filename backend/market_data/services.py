from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Iterable

from django.utils.dateparse import parse_date, parse_datetime

from .models import MarketDailyBar, MarketMetricSnapshot, MarketNewsArticle, TrackedSymbol


DEFAULT_TRACKED_SYMBOLS = {
    "SCHG": Decimal("27.0000"),
    "SCHD": Decimal("22.5000"),
    "VXUS": Decimal("18.0000"),
    "VB": Decimal("22.5000"),
    "BTC-USD": Decimal("10.0000"),
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


@dataclass(frozen=True)
class NewsArticle:
    symbol: str
    title: str
    url: str
    publisher: str = ""
    summary: str = ""
    thumbnail_url: str = ""
    published_at: datetime | None = None
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
            title_key = key[:1].upper() + key[1:]
            if title_key in row:
                return row[title_key]
        lower_row = {str(row_key).lower(): value for row_key, value in row.items()}
        for key in keys:
            if key.lower() in lower_row:
                return lower_row[key.lower()]
        return None
    for key in keys:
        if hasattr(row, key):
            return getattr(row, key)
    return None


def _rows_from_market_result(result: Any) -> list[Any]:
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


def _clean_json_value(value: Any) -> Any:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, dict):
        return {str(key): _clean_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clean_json_value(item) for item in value]
    return value


def _published_at_from_value(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    parsed = parse_datetime(str(value))
    if parsed:
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _content_value(content: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in content:
            return content[key]
    return None


class YFinanceMarketDataClient:
    def __init__(self, provider: str = "yfinance"):
        self.provider = provider

    def fetch_daily_history(self, symbol: str, *, start_date: str | None = None) -> list[DailyBar]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise MarketDataError("yfinance is not installed in this backend environment.") from exc

        kwargs: dict[str, Any] = {"period": "1y", "interval": "1d", "auto_adjust": False}
        if start_date:
            kwargs = {"start": start_date, "interval": "1d", "auto_adjust": False}
        history = yf.Ticker(symbol).history(**kwargs)
        if getattr(history, "empty", False):
            raise MarketDataError(f"No yfinance price history returned for {symbol}.")
        return normalize_daily_bars(symbol, history.reset_index().to_dict("records"))

    def fetch_news(self, symbol: str, *, limit: int = 8) -> list[NewsArticle]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise MarketDataError("yfinance is not installed in this backend environment.") from exc

        raw_news = yf.Ticker(symbol).news or []
        articles: list[NewsArticle] = []
        for item in raw_news[:limit]:
            content = item.get("content", item) if isinstance(item, dict) else {}
            if not isinstance(content, dict):
                continue

            canonical_url = _content_value(content, "canonicalUrl", "clickThroughUrl", "link") or {}
            url = canonical_url.get("url") if isinstance(canonical_url, dict) else canonical_url
            title = _content_value(content, "title")
            if not title or not url:
                continue

            thumbnail = _content_value(content, "thumbnail", "thumbnailUrl") or {}
            thumbnail_url = ""
            if isinstance(thumbnail, dict):
                resolutions = thumbnail.get("resolutions") or []
                if resolutions and isinstance(resolutions[0], dict):
                    thumbnail_url = resolutions[0].get("url") or ""
                thumbnail_url = thumbnail_url or thumbnail.get("url") or ""
            elif isinstance(thumbnail, str):
                thumbnail_url = thumbnail

            articles.append(
                NewsArticle(
                    symbol=symbol.upper(),
                    title=str(title),
                    url=str(url),
                    publisher=str(_content_value(content, "provider", "publisher") or ""),
                    summary=str(_content_value(content, "summary", "description") or ""),
                    thumbnail_url=str(thumbnail_url or ""),
                    published_at=_published_at_from_value(
                        _content_value(content, "pubDate", "displayTime", "providerPublishTime")
                    ),
                    raw=_clean_json_value(item) if isinstance(item, dict) else {},
                )
            )
        return articles


def normalize_daily_bars(symbol: str, result: Any) -> list[DailyBar]:
    bars: list[DailyBar] = []
    for row in _rows_from_market_result(result):
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
                raw=_clean_json_value(dict(row)) if isinstance(row, dict) else {},
            )
        )
    return sorted(bars, key=lambda bar: bar.date)


def seed_default_symbols() -> list[TrackedSymbol]:
    tracked = []
    for symbol, weight in DEFAULT_TRACKED_SYMBOLS.items():
        obj, _ = TrackedSymbol.objects.update_or_create(
            symbol=symbol,
            defaults={
                "asset_type": "crypto" if symbol == "BTC-USD" else "etf",
                "provider": "yfinance",
                "target_weight_percent": weight,
                "active": True,
            },
        )
        tracked.append(obj)
    TrackedSymbol.objects.filter(symbol="QQQM").update(active=False, target_weight_percent=None)
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


def refresh_market_data(symbols: list[str] | None = None, provider: str = "yfinance", client: YFinanceMarketDataClient | None = None) -> dict[str, Any]:
    if not symbols:
        seed_default_symbols()
        symbols = list(DEFAULT_TRACKED_SYMBOLS.keys())
    normalized_symbols = [symbol.strip().upper() for symbol in symbols if symbol.strip()]
    market_client = client or YFinanceMarketDataClient(provider=provider)

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
            news_count = 0
            for article in market_client.fetch_news(symbol):
                MarketNewsArticle.objects.update_or_create(
                    symbol=symbol,
                    url=article.url,
                    provider=provider,
                    defaults={
                        "title": article.title,
                        "publisher": article.publisher,
                        "summary": article.summary,
                        "thumbnail_url": article.thumbnail_url,
                        "published_at": article.published_at,
                        "raw": article.raw or {},
                    },
                )
                news_count += 1
            refreshed["symbols"][symbol] = {
                "bars": len(bars),
                "news": news_count,
                "as_of": snapshot.as_of.isoformat() if snapshot else None,
            }
        except Exception as exc:
            refreshed["errors"][symbol] = str(exc)
    return refreshed
