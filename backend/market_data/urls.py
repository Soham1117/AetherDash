from django.urls import path

from . import views

urlpatterns = [
    path("symbols/", views.symbols, name="market_symbols"),
    path("symbols/<str:symbol>/history/", views.symbol_history, name="market_symbol_history"),
    path("symbols/<str:symbol>/metrics/", views.symbol_metrics, name="market_symbol_metrics"),
    path("symbols/<str:symbol>/news/", views.symbol_news, name="market_symbol_news"),
    path("summary/", views.summary, name="market_summary"),
    path("refresh/", views.refresh, name="market_refresh"),
]
