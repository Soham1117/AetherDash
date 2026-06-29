from django.urls import path

from . import views

urlpatterns = [
    path("snaptrade/connect/", views.begin_snaptrade_connect, name="snaptrade_connect"),
    path("snaptrade/callback/", views.complete_snaptrade_connect, name="snaptrade_callback"),
    path("snaptrade/status/", views.snaptrade_status, name="snaptrade_status"),
    path("snaptrade/refresh/", views.refresh_snaptrade_data, name="snaptrade_refresh"),
    path("snaptrade/webhook/", views.snaptrade_webhook, name="snaptrade_webhook"),
    path("kraken/refresh/", views.refresh_kraken_data, name="kraken_refresh"),
    path("kraken/ledger/", views.kraken_ledger, name="kraken_ledger"),
    path("tastytrade/status/", views.tastytrade_status, name="tastytrade_status"),
    path("tastytrade/snapshot/", views.tastytrade_snapshot, name="tastytrade_snapshot"),
    path("tastytrade/order-dry-run/", views.tastytrade_order_dry_run, name="tastytrade_order_dry_run"),
    path("portfolio/summary/", views.portfolio_summary, name="portfolio_summary"),
]
