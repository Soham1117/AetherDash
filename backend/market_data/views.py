from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from .models import MarketDailyBar, MarketMetricSnapshot, TrackedSymbol
from .serializers import MarketDailyBarSerializer, MarketMetricSnapshotSerializer, TrackedSymbolSerializer
from .services import refresh_market_data, seed_default_symbols


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def symbols(request):
    if request.query_params.get("seed") == "true":
        seed_default_symbols()
    queryset = TrackedSymbol.objects.filter(active=True).order_by("symbol")
    return JsonResponse({"symbols": TrackedSymbolSerializer(queryset, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def symbol_history(request, symbol):
    limit = int(request.query_params.get("limit", "120"))
    provider = request.query_params.get("provider", "yfinance")
    queryset = MarketDailyBar.objects.filter(
        symbol=symbol.upper(),
        provider=provider,
    ).order_by("-date")[:limit]
    return JsonResponse({"history": MarketDailyBarSerializer(queryset, many=True).data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def symbol_metrics(request, symbol):
    provider = request.query_params.get("provider", "yfinance")
    snapshot = MarketMetricSnapshot.objects.filter(
        symbol=symbol.upper(),
        provider=provider,
    ).order_by("-as_of").first()
    return JsonResponse({"metrics": MarketMetricSnapshotSerializer(snapshot).data if snapshot else None})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def summary(request):
    seed_default_symbols()
    tracked = TrackedSymbol.objects.filter(active=True).order_by("symbol")
    symbols_data = []
    for tracked_symbol in tracked:
        metric = MarketMetricSnapshot.objects.filter(
            symbol=tracked_symbol.symbol,
            provider=tracked_symbol.provider or "yfinance",
        ).order_by("-as_of").first()
        symbols_data.append({
            "symbol": TrackedSymbolSerializer(tracked_symbol).data,
            "metrics": MarketMetricSnapshotSerializer(metric).data if metric else None,
        })
    return JsonResponse({"symbols": symbols_data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refresh(request):
    symbols_param = request.data.get("symbols")
    symbols = symbols_param if isinstance(symbols_param, list) else None
    provider = request.data.get("provider") or "yfinance"
    result = refresh_market_data(symbols=symbols, provider=provider)
    status = 207 if result.get("errors") else 200
    return JsonResponse({"refresh": result}, status=status)
